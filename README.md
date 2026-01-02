# TalkVault Backend

카카오톡 대화 내역을 PDF와 Excel 파일로 변환하는 백엔드 API 서버입니다.

## 🚀 주요 기능

- **파일 업로드 및 변환**: 카카오톡 TXT 파일을 업로드하여 PDF/Excel로 자동 변환
- **별도 Export API**: PDF 또는 Excel만 개별적으로 다운로드 가능
- **사용자 인증**: JWT 기반 인증 시스템
- **히스토리 관리**: 업로드한 파일 이력 조회 및 삭제
- **Supabase 스토리지**: 변환된 파일을 Supabase에 저장

## 📋 기술 스택

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.1
- **Database**: PostgreSQL (TypeORM)
- **Storage**: Supabase Storage
- **Authentication**: JWT (Passport)
- **File Processing**: 
  - PDFKit (PDF 생성)
  - ExcelJS (Excel 생성)
  - iconv-lite (인코딩 변환)

## 📁 프로젝트 구조

```
src/
├── auth/              # 인증 모듈 (회원가입, 로그인, JWT)
├── user/              # 사용자 관리 모듈
├── upload/            # 파일 업로드 및 변환 모듈
├── export/            # PDF/Excel 개별 Export 모듈
├── history/           # 히스토리 관리 모듈
├── entities/          # TypeORM 엔티티
├── common/            # 공통 유틸리티 (필터, Supabase 클라이언트)
└── config/            # 설정 파일 (TypeORM 등)
```

## 🛠️ 설치 및 실행

### 필수 요구사항

- Node.js 22.x 이상
- PostgreSQL 데이터베이스
- Supabase 계정 및 프로젝트

### 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# 데이터베이스
DB_HOST=your_db_host
DB_PORT=5432
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password
DB_DATABASE=your_db_name
DB_SCHEMA=talk_vault

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# CORS
CORS_ORIGIN=https://your-frontend-url.com

# 서버
PORT=3000
NODE_ENV=production
```

### 설치

```bash
npm install
```

### 개발 모드 실행

```bash
npm run start:dev
```

### 프로덕션 빌드

```bash
npm run build
npm run start:prod
```

## 📡 API 엔드포인트

### 인증 (Auth)

- `POST /auth/signup` - 회원가입
- `POST /auth/login` - 로그인
- `POST /auth/refresh` - 토큰 갱신
- `POST /auth/logout` - 로그아웃

### 파일 업로드 (Upload)

- `POST /upload` - 카카오톡 TXT 파일 업로드 및 PDF/Excel 자동 변환
  - 인증 필요 (JWT)
  - 파일: `multipart/form-data` 형식의 `file` 필드

### Export (별도 다운로드)

- `POST /export/pdf` - TXT 파일을 PDF로 변환하여 다운로드
  - 인증 필요 (JWT)
  - 파일: `multipart/form-data` 형식의 `file` 필드

- `POST /export/excel` - TXT 파일을 Excel로 변환하여 다운로드
  - 인증 필요 (JWT)
  - 파일: `multipart/form-data` 형식의 `file` 필드

### 히스토리 (History)

- `GET /histories` - 내 업로드 이력 조회
  - 인증 필요 (JWT)

- `GET /histories/:id/download` - 파일 다운로드
  - 인증 필요 (JWT)
  - 소유권 확인 필요

- `DELETE /histories/:id` - 히스토리 삭제
  - 인증 필요 (JWT)
  - 소유권 확인 필요
  - Supabase에서 파일도 함께 삭제

### 사용자 (User)

- `GET /users/:id` - 사용자 정보 조회
- `PATCH /users/:id` - 사용자 정보 수정
- `DELETE /users/:id` - 사용자 삭제

## 📝 카카오톡 TXT 파일 형식

현재 지원하는 카카오톡 TXT 파일 형식:

```
IT 신여진님 님과 카카오톡 대화
저장한 날짜 : 2025-12-31 15:08:36

--------------- 2025년 12월 29일 월요일 ---------------
[IT 신여진님] [오전 11:32] 메시지 내용
[이희도] [오후 12:43] 메시지 내용
```

- 날짜 구분선: `--------------- YYYY년 MM월 DD일 요일 ---------------`
- 메시지 형식: `[이름] [오전/오후 HH:MM] 메시지 내용`

## 🔧 주요 기능 상세

### 파일 인코딩 처리

- 자동 인코딩 감지: CP949(EUC-KR), UTF-8 등 여러 인코딩 자동 감지
- 점수 기반 선택: 패턴 매칭 점수를 기반으로 최적 인코딩 선택

### PDF 생성

- 한글 폰트 지원: NanumGothic 폰트 사용
- 배포 환경 대응: 여러 경로에서 폰트 파일 자동 탐색

### Excel 생성

- ExcelJS를 사용한 Excel 파일 생성
- 날짜, 발신자, 메시지 컬럼으로 구성

### Supabase 통합

- 파일 저장: 변환된 PDF/Excel을 Supabase Storage에 저장
- Public URL: 저장된 파일의 공개 URL 생성
- 파일 삭제: 히스토리 삭제 시 Supabase에서도 파일 삭제

## 🚢 배포

### Render 배포

1. GitHub 저장소 연결
2. 빌드 명령: `npm install; npm run build`
3. 시작 명령: `npm run start:prod`
4. 환경 변수 설정

### 폰트 파일

배포 시 `assets/fonts/` 폴더의 폰트 파일이 자동으로 `dist/assets/fonts/`로 복사됩니다.

## 📦 의존성

주요 패키지:

- `@nestjs/core`, `@nestjs/common`: NestJS 프레임워크
- `@nestjs/typeorm`, `typeorm`: ORM
- `@nestjs/jwt`, `passport-jwt`: JWT 인증
- `@supabase/supabase-js`: Supabase 클라이언트
- `pdfkit`: PDF 생성
- `exceljs`: Excel 생성
- `iconv-lite`: 인코딩 변환
- `bcrypt`: 비밀번호 해싱

## 🔒 보안

- JWT 기반 인증
- 비밀번호 bcrypt 해싱
- CORS 설정
- 소유권 확인 (Guards)

## 📄 라이선스

UNLICENSED

## 👥 기여

이슈 및 Pull Request는 언제나 환영합니다!

