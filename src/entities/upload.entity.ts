import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
  } from 'typeorm';
  
  @Entity('uploads')
  export class Upload {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column()
    originalFileName: string;
  
    @Column()
    savedFileName: string;
  
    @Column()
    filePath: string;
  
    @Column({ nullable: true })
    pdfPath: string;
  
    @Column({ nullable: true })
    excelPath: string;
  
    @Column()
    fileSize: number;
  
    @Column()
    userId: string;
  
    @CreateDateColumn()
    createdAt: Date;
  }
  