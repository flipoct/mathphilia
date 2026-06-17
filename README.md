# Mathphilia Blog

강원과학고등학교 수학 동아리 매스필리아용 공개 수학 블로그입니다.

## 구조

- 첫 화면은 포스트 목록입니다.
- 포스트 카드를 누르면 `/posts/1`처럼 숫자 주소의 읽기 화면으로 이동합니다.
- `/posts/1`처럼 글 주소로 바로 접속해도 해당 글이 열립니다.
- 글쓰기, 수정, 삭제는 비밀번호 입력 후 가능합니다.
- 수식은 KaTeX로 렌더링됩니다.
- 인라인 수식은 `$...$`, 블록 수식은 `$$...$$` 문법을 사용합니다.
- 글 데이터는 Vercel에서는 Vercel Blob, 로컬 개발에서는 `data/posts.json`에 저장됩니다.

## 로컬 실행

```powershell
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다.

## Vercel 배포

```powershell
npm i -g vercel
vercel login
vercel link
vercel blob create-store mathphilia-posts
vercel env add BLOG_PASSWORD
npm run deploy
```

Vercel 대시보드로 설정하려면 프로젝트의 Storage 탭에서 Blob 저장소를 만들고, 해당 프로젝트 환경 변수에 `BLOB_READ_WRITE_TOKEN`이 연결되어 있는지 확인합니다.

## 비밀번호

- 로컬 기본 비밀번호는 `mathphilia`입니다.
- Vercel에서는 `BLOG_PASSWORD` 환경 변수 값이 글쓰기 비밀번호가 됩니다.
- `BLOG_PASSWORD`를 설정하지 않으면 배포 환경에서도 `mathphilia`가 기본값으로 사용됩니다.

## 초기 글

초기 글은 `data/posts.json`에 있습니다. Blob 저장소를 연결하기 전에는 이 파일을 읽습니다. Blob 저장소가 연결된 뒤 새 글을 저장하면 Blob의 `data/posts.json`이 공개 블로그의 실제 데이터가 됩니다.
