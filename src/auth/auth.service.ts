import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { supabase } from '@/common/supabase/supabase.client';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = this.userRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      profileImageUrl: null,
    });

    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
      },
    };
  }

  async signup(dto: SignupDto, file?: any) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
  
    let profileImageUrl: string | null = null;
  
    if (file) {
      profileImageUrl = await this.uploadProfileImage(file);
    }
  
    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      profileImageUrl,
    });
  
    await this.userRepository.save(user);
  
    return { message: 'Signup successful', user: { email: user.email, profileImageUrl: user.profileImageUrl } };
  }
  

  private async uploadProfileImage(file: any) {
    const fileExt = file.originalname.split('.').pop();
    const fileName = `profile_${Date.now()}.${fileExt}`;
  
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_PROFILE_BUCKET!)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
  
    if (error) throw error;
  
    const { data: publicUrl } = supabase.storage
      .from(process.env.SUPABASE_PROFILE_BUCKET!)
      .getPublicUrl(fileName);
  
    return publicUrl.publicUrl;
  }

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
      },
    };
  }

  async refresh(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException();
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: null });
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    await this.userRepository.update(userId, { refreshToken: refreshToken });
  }
}

