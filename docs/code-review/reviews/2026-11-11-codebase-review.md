# Code review toàn bộ codebase — gemini-flashcards

- **Ngày:** 2026-11-11
- **Phạm vi:** `src/` (services, hooks, components), `supabase/functions/generate-flashcards`, `supabase/migrations`, cấu hình build/CI (`package.json`, `vite.config.ts`, `vercel.json`, `.github/workflows`).
- **Commit được review:** `cd302b5` (working tree sạch).
- **Mức độ** theo [`standards.md` §2](../standards.md): `[blocker]` / `[major]` / `[minor]` / `[nit]`.

## Kết quả kiểm tra tự động

| Lệnh | Kết quả |
|---|---|
| `npm run lint` | ✅ 0 lỗi |
| `npm run typecheck` | ✅ 0 lỗi |
| `npm test` | ✅ 82/82 test pass (4 file) |
| `npm audit --omit=dev` | ⚠️ 4 lỗ hổng: `xlsx` (high, không có bản fix trên npm), `zod <4.6.6` (high, có fix), `fast-xml-parser` qua `reamkit` (low) |

## Tóm tắt

Phần scheduler (spaced repetition), Edge Function và RLS cho `card_reviews`/`review_logs` được viết cẩn thận: validate input ở server, kiểm tra JWT tường minh, CORS allowlist, xử lý timezone/DST có test, `revoke` đúng trên hàm `security definer`. Comment giải thích lý do thiết kế rất tốt.

Các vấn đề chính nằm ở chỗ khác:

1. **Mất dữ liệu:** xoá deck không cần xác nhận, kéo theo toàn bộ lịch sử ôn tập (cascade).
2. **Số liệu sai âm thầm:** các query không phân trang sẽ bị PostgREST cắt ở 1000 dòng (mặc định của Supabase), nên thống kê và bộ đếm deck sai với người dùng nhiều dữ liệu.
3. **Retry chồng nhiều tầng:** một lần bấm "Generate" có thể gọi Gemini tới 36×N lần (N = số API key). Thêm vào đó không có rate limit theo user.
4. **Thông báo lỗi bị mất:** client không đọc body lỗi của Edge Function, nên người dùng chỉ thấy "non-2xx status code".
5. **Schema drift:** bảng `profiles` và bucket `avatars` không có trong migrations.
6. **Signup chặn tên tiếng Việt** (ví dụ "Nguyễn").

---

## 1. Blocker

### 1.1 `[blocker]` Xoá deck không có bước xác nhận, mất luôn lịch sử ôn tập
- `src/components/DeckList.tsx` (nút Trash, `onDeleteDeck(deck.id)`), `src/hooks/useDashboardState.ts` `deleteDeckById`.
- Một cú click (hoặc click nhầm trên mobile) xoá deck ngay. `card_reviews.deck_id` và `review_logs.deck_id` đều là `on delete cascade`, nên toàn bộ tiến độ SRS và log của deck cũng mất. Không có undo.
- `deleteDeckById` còn nuốt lỗi (`catch` chỉ `console.error`), nên khi xoá thất bại người dùng không được báo.
- **Đề xuất:** thêm dialog xác nhận (ghi rõ số thẻ và việc mất lịch sử ôn tập), hiển thị toast khi lỗi. Nếu muốn an toàn hơn: soft delete (`deleted_at`) kèm job dọn dẹp sau.

### 1.2 `[blocker]` Query không phân trang bị cắt ở 1000 dòng, thống kê sai mà không báo
- `src/services/reviewStatsService.ts` `getReviewStats`: lấy `review_logs` 30 ngày **và toàn bộ** `card_reviews` của user.
- `src/services/spacedRepetitionService.ts` `getDeckProgressBatch` (dòng ~757–762): lấy `card_reviews` của **mọi deck** trong một request.
- Supabase mặc định giới hạn API "Max rows" = 1000. Bản thân comment trong `reviewStatsService.ts` đã ước tính "a heavy user produces a few thousand rows in 30 days", tức là vượt giới hạn. Khi đó retention, streak, forecast và các bộ đếm new/due/mastered trên dashboard đều sai, và không có lỗi nào hiện ra.
- **Đề xuất:** chuyển phần tổng hợp vào RPC SQL (`group by deck_id, day`) để chỉ trả về vài chục dòng; hoặc tối thiểu là phân trang bằng `.range()` và có test cho trường hợp > 1000 dòng.

---

## 2. Major

### 2.1 `[major]` Retry nhân lên qua 4 tầng, tốn quota/chi phí và gây timeout
Một lần generate deck đi qua các tầng:
1. `CreateDeck.tsx` `attemptGeneration`: 4 lần (attempt 0..3), **retry cả lỗi không retry được** như 400/401/413.
2. `utils/retry.ts` `withRetry`: 3 lần cho 5xx/408.
3. Edge Function `generateContent`: 3 lần cho **mỗi** key, rồi chuyển sang key kế tiếp, kể cả khi lỗi là 503 "overloaded" của toàn provider (đổi key không giúp gì).

Tệ nhất là 4 × 3 × 3 × N lời gọi Gemini cho một click. Edge Function có idle timeout 150s ([Supabase limits](https://supabase.com/docs/guides/functions/limits)). Vòng retry phía server với nhiều key dễ vượt mốc này, trả 504, và 504 lại kích hoạt retry phía client.
- **Đề xuất:** chỉ giữ retry ở **một** tầng (server). Bỏ `attemptGeneration` trong `CreateDeck`. Ở client, chỉ retry lỗi mạng chứ không retry 5xx do server tự sinh (`AI_*`). Server chỉ đổi key khi `status === 429`, đặt ngân sách thời gian tổng (ví dụ 60s) cho cả vòng lặp, và không đánh dấu key "failed" vì lỗi 4xx do nội dung request.

### 2.2 `[major]` Không có rate limit/quota theo user cho Edge Function
- `supabase/functions/generate-flashcards/index.ts`: chỉ kiểm tra JWT hợp lệ. Bất kỳ tài khoản nào cũng có thể gọi liên tục `generateFromPDF`/`generateDeck` và đốt hết quota của mọi key.
- `QuizMode` gọi `generateDistractors` **mỗi lần mở quiz** mà không cache, nên deck 50 thẻ tốn 5 request mỗi lần.
- **Đề xuất:** thêm bảng đếm usage theo `user_id`/ngày (kiểm tra trong function bằng service role), hoặc dùng Upstash/Redis. Cache distractors theo `(deck_id, card_id, hash(back))`, có thể lưu ngay trong `decks.cards`.

### 2.3 `[major]` Client không hiển thị được thông báo lỗi của Edge Function
- `aiService.ts` (dòng 30–36, 79–85), `fileService.ts` (dòng 224–230, 283–289).
- Khi function trả non-2xx, `supabase.functions.invoke` trả `data = null` và `error` là `FunctionsHttpError` với message chung "Edge Function returned a non-2xx status code". Body JSON (`{ error, code }`) nằm trong `error.context` nhưng không được đọc. Hệ quả là các thông báo thân thiện ở server ("PDF files must be 50 MB or smaller", "Too many requests…") không bao giờ tới người dùng. Nhánh `if (data.error)` là dead code.
- **Đề xuất:** viết helper chung `invokeGenerate()` đọc `await error.context.json()` để lấy `code`/`error`, map `code` sang thông báo UI. Gom luôn 4 chỗ gọi `invoke` đang lặp code.

### 2.4 `[major]` Giới hạn PDF 50 MB vượt quá tài nguyên của Edge Function
- `index.ts` dòng 13–15, `parseRequest` dòng 292.
- PDF 50 MB thành chuỗi base64 khoảng 67 MB. Function lại tạo thêm nhiều bản sao: `req.text()`, `TextEncoder().encode()` chỉ để đo byte, `JSON.parse`, regex trên cả chuỗi, rồi SDK serialize lại để gửi Gemini. Supabase giới hạn 256 MB RAM và 2s CPU mỗi request ([limits](https://supabase.com/docs/guides/functions/limits)), nên file lớn rất có thể bị lỗi 546 (WORKER_LIMIT).
- **Đề xuất:** hạ giới hạn xuống mức đã đo thực tế được (ví dụ 15–20 MB) ở cả client và server. Đo kích thước bằng `rawBody.length` (base64 là ASCII) thay vì encode. Với file lớn, upload lên Storage rồi để function stream sang Gemini Files API.

### 2.5 `[major]` `reviewCard` không atomic, undo có thể hoàn tác sai rating
- `spacedRepetitionService.ts` `reviewCard`: select → upsert → insert log là 3 request riêng.
- Nếu insert log thất bại (dòng 343), code ghi rằng "undo unavailable for this rating". Thực tế `undoLastReview` lấy log mới nhất **chưa undo**, tức log của rating **trước đó**, rồi ghi đè state của thẻ bằng state cũ hơn. Nếu đó là cùng một thẻ (thẻ Again được requeue rồi chấm lại), UI không phát hiện được vì `restored.cardId === action.cardId`, và state bị lùi hai bước.
- **Đề xuất:** gộp upsert và insert log vào một RPC `review_card(...)` chạy trong transaction. Cách này cũng giảm từ 3 round trip xuống 1 cho mỗi lần chấm điểm.

### 2.6 `[major]` Validation tên chặn tên tiếng Việt
- `src/utils/validation.ts` `nameSchema`: `/^[a-zA-Z\s\u00C0-\u024F]+$/`.
- Các ký tự như `ễ ệ ộ ứ ỹ` nằm trong khối U+1E00–U+1EFF nên bị từ chối. "Nguyễn Văn Trung" không đăng ký được. Tên có `-` hoặc `'` cũng bị chặn.
- **Đề xuất:** `/^[\p{L}\p{M}\s'.-]+$/u` và thêm `.trim()`.

### 2.7 `[major]` Schema drift: `profiles` và bucket `avatars` không có trong migrations
- Code dùng `profiles` (`authService.updateProfile`, `storageService`, `profileService`) nhưng không migration nào tạo bảng này hay định nghĩa RLS cho nó. Bucket `avatars` cũng không được tạo (chỉ có policy trên `storage.objects`).
- Tạo môi trường mới từ migrations sẽ hỏng phần profile. Không review được RLS của `profiles`.
- **Đề xuất:** `supabase db diff` để kéo schema `profiles` + RLS và bucket (`allowed_mime_types`, `file_size_limit`) về thành migration.

### 2.8 `[major]` Deploy không phụ thuộc CI
- `.github/workflows/deploy.yml`: chạy song song với CI khi push lên `main`, nên code fail test vẫn lên production. Workflow này dùng Node 20 trong khi `engines` và CI dùng 24, dùng `npm install` thay vì `npm ci`, và build local xong lại để `vercel --prod` build lần nữa.
- **Đề xuất:** gộp vào CI dưới dạng job `deploy` với `needs: quality`, dùng Node 24 + `npm ci`, `vercel build --prod` + `vercel deploy --prebuilt`. Nếu Vercel Git Integration đang bật thì bỏ hẳn workflow này để tránh deploy hai lần.

### 2.9 `[major]` Edge Function (ranh giới bảo mật) không có test và không được kiểm tra trong CI
- `index.ts` có 877 dòng với validate input, auth, CORS và parse response AI nhưng không có test nào. CI không chạy `deno check`/`deno lint` cho thư mục `supabase/functions`.
- **Đề xuất:** tách các hàm thuần (`parseRequest`, `validateCards`, `normalizeFlashcards`, `getNextApiKey`, `isRetryableError`) ra module riêng, viết `deno test`, và thêm step `deno check` vào CI.

### 2.10 `[major]` Dependency có lỗ hổng
- `xlsx@0.18.5`: prototype pollution và ReDoS (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9). SheetJS không còn phát hành bản sửa trên npm. Thư viện này parse file người dùng upload, có thể là file được người khác chia sẻ.
- `zod <4.6.6`: có bản fix, chạy `npm audit fix`.
- **Đề xuất:** cài `xlsx` từ CDN của SheetJS (bản ≥ 0.20.2) hoặc chuyển sang thư viện khác. Nâng `zod`.

---

## 3. Minor

### Edge Function
- `[minor]` `shouldSwitchKey` (dòng 529) dò chuỗi `"429"`/`"quota"` trong message. Nên dùng `getErrorStatus(error) === 429`, vì `ApiError` của `@google/genai` có field `status`.
- `[minor]` Lỗi 4xx từ Gemini (ví dụ PDF hỏng) làm key bị đánh dấu failed, function thử hết các key rồi trả 502 "Failed to generate content". Lỗi do input nên trả 400 với thông báo rõ ràng.
- `[minor]` `MAX_CARD_TEXT_BYTES = 5000` **byte**, trong khi `EditDeckPage` cho phép 4000 **ký tự** ở mặt sau. Tiếng Việt có dấu chiếm 2–3 byte/ký tự, nên thẻ dài làm cả chunk `generateDistractors` bị 400 và quiz âm thầm rơi về fallback. Cần thống nhất giới hạn (đếm cùng một đơn vị).
- `[minor]` `std@0.168.0/http/server.ts` `serve` đã deprecated. Nên dùng `Deno.serve` và import `npm:` có pin version thay cho `esm.sh`.
- `[nit]` `MODEL_NAME` hard-code. Nên đọc từ env để đổi model không cần deploy lại.

### Client — tạo deck và import file
- `[minor]` `CreateDeckModal.tsx`: cả cây desktop (`hidden md:grid`) và mobile (`md:hidden`) đều được mount, nên `CreateDeck`/`FileUploadDeck` render 2 lần và có `id="topic"`/`id="numQuestions"` trùng nhau (label trỏ sai, a11y hỏng). Modal không có `role="dialog"`, không có `aria-modal`, không đóng bằng Escape, không bẫy focus, và click overlay đóng modal ngay cả khi đang generate.
- `[minor]` `FileUploadDeck.tsx`: `numQuestions` dùng `Number(e.target.value)` nên có thể là 0, NaN hoặc số lẻ, và server trả 400 (người dùng lại chỉ thấy lỗi chung, xem 2.3). Không reset `input.value`, nên chọn lại cùng một file không kích hoạt `onChange`. `file.name.split('.')[0]` biến "bai.giang.v2.pdf" thành "bai".
- `[minor]` `CreateDeck` giới hạn 20 câu, `FileUploadDeck` và server cho 50. Nên thống nhất một hằng số dùng chung.
- `[minor]` `fileService.ts`:
  - Nhận dạng loại file chỉ qua `file.type`. Trên Windows file `.csv` thường có type `application/vnd.ms-excel`, và `.json` có thể có type rỗng. Nên kiểm tra thêm extension.
  - Nhánh JSON `catch {}` (dòng 182) nuốt mất thông báo lỗi chi tiết vừa throw ở trên.
  - Dòng tiêu đề "Question,Answer" của CSV/Excel bị import thành một thẻ.
  - Pipeline Q&A serialize thành text `Q:/A:` rồi `FileUploadDeck` lại parse bằng regex. Câu hỏi chứa `\n\n` hoặc `\nA:` sẽ bị cắt sai. Nên trả về mảng `{front, back}` trực tiếp.
  - Text > 500 KB bị server từ chối. Nên kiểm tra ở client trước khi gửi.

### Client — ôn tập, quiz, chỉnh sửa
- `[minor]` `EditDeckPage.handleSave` gọi `onSave` không `await` và set "Saved" ngay, nên khi lưu lỗi vẫn hiện "Saved" bên cạnh toast lỗi. Kiểu prop `onSave: (...) => void` che mất Promise. Không cảnh báo khi rời trang với thay đổi chưa lưu. Trên mobile không chỉnh được description và không có danh sách thẻ.
- `[minor]` `QuizMode`: deck < 4 thẻ thì có ít hơn 4 lựa chọn (deck 1 thẻ chỉ có đúng đáp án). Các thẻ có cùng `back` tạo đáp án trùng. `setTimeout` trong `handleAnswer` không được clear khi unmount. Fallback dùng `sort(() => Math.random() - 0.5)` (phân phối lệch) trong khi file đã có sẵn `shuffleArray`.
- `[minor]` `useDashboardState`: gọi `fetchProgressForDecks` (side effect) **bên trong** updater của `setDecks`, và updater phải là hàm thuần (StrictMode gọi 2 lần). `syncAuthState` chạy cả từ `getSession()` lẫn sự kiện `INITIAL_SESSION`, nên lúc khởi động tải decks 2 lần. Mỗi `TOKEN_REFRESHED` cũng tải lại toàn bộ decks và không chống race giữa các response. `createDeck`/`updateDeckById`/`deleteDeckById` gọi `getUser()` (round trip tới Auth server) dù `user` đã có trong state.
- `[minor]` `DeckList`: thẻ deck và ô "Create New Deck" là `div` có `onClick`, nên không dùng được bằng bàn phím. Prop `onUpdateDeck` không được dùng.

### Auth và profile
- `[minor]` `Signup.handleResendVerification` gọi lại `signUp` thay vì `supabase.auth.resend({ type: 'signup', email })`.
- `[minor]` `AuthCallback.tsx`: nếu hash không có `access_token` (người dùng huỷ OAuth, có `error_description`, hoặc flow PKCE dùng `?code=`), màn hình "Authenticating..." treo mãi.
- `[minor]` Có hai cách login Google với `redirectTo` khác nhau: `Login.tsx` dùng `/auth/callback`, còn `authService.loginWithGoogle` dùng origin và không được dùng.
- `[minor]` `ProfileEditor`: đổi mật khẩu không áp `passwordSchema` và không yêu cầu mật khẩu hiện tại. Nên bật "Secure password change" trong Supabase Auth. Tên không được validate (cho phép rỗng).
- `[minor]` `storageService.uploadAvatar`:
  - Chấp nhận mọi `image/*`, kể cả SVG (có thể chứa script khi mở trực tiếp URL public).
  - Extension lấy từ tên file người dùng.
  - Avatar cũ không bị xoá, nên Storage tích luỹ file rác.
  - `profiles.avatar_url` được ghi ngay khi upload, kể cả khi người dùng bấm Cancel.
  - Insert policy chỉ kiểm tra `auth.role() = 'authenticated'`, không ràng buộc đường dẫn theo `user_id`.

  **Đề xuất:** giới hạn MIME (png/jpeg/webp) ở cấu hình bucket, lưu theo đường dẫn `${userId}/avatar.<ext>` với policy `(storage.foldername(name))[1] = auth.uid()::text`.

### Database
- `[minor]` `decks.updated_at` không có trigger nên không bao giờ được cập nhật. `handle_updated_at()` là hàm rỗng.
- `[minor]` `decks_user_id_fkey` không có `on delete cascade`, nên xoá user trong Auth sẽ lỗi hoặc để lại dữ liệu mồ côi.
- `[nit]` `deck_likes`, `decks.parentId`, `decks.isFolder` không được dùng.

### Cấu hình và dependency
- `[minor]` Dependency không dùng: `@google/genai`, `@google/generative-ai`, `uuid`, `debug`, `gsap`, `@headlessui/react`, `zod-to-json-schema`. Dev: `glob`, `lru-cache`, `npmlog`, `rimraf`. `vite.config.ts` còn `optimizeDeps.exclude: ['pdf-parse']` dù package này không còn tồn tại.
- `[minor]` Code chết: `src/services/profileService.ts` (cả file, trùng chức năng với `authService.updateProfile`), `authService.loginWithGoogle`, `verifyOtp`, `storageService.deleteAvatar`.
- `[minor]` `vercel.json` chưa có security headers (`Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`).

---

## 4. Nit
- `[nit]` Comment lẫn tiếng Việt và tiếng Anh (`AuthCallback.tsx`). Nên chọn một ngôn ngữ.
- `[nit]` `CreateDeck` hiển thị `${message}. Please try again.`, dễ thành hai dấu chấm.
- `[nit]` `Toast` thiếu `role="status"`/`aria-live`, nút đóng thiếu `aria-label`.
- `[nit]` Trên `DeckList`, các bộ đếm `learning` và `due` chồng lấn nhau (thẻ learning đến hạn được tính ở cả hai), nên tổng các badge không bằng số thẻ. Nếu đó là chủ đích thì nên ghi chú cho người dùng.
- `[nit]` `SpacedReviewMode` chưa có phím tắt (Space để lật, 1–4 để chấm điểm). Đây là tính năng chuẩn của ứng dụng SRS.

---

## 5. Điểm làm tốt
- Edge Function validate chặt: kiểu, độ dài theo byte, regex id, trùng id, schema response AI. Kiểm tra JWT tường minh dù đã bật `verify_jwt`. CORS dùng allowlist.
- RLS cho `card_reviews`/`review_logs` ràng buộc cả quyền sở hữu deck. `prune_review_logs` là `security definer` nhưng `revoke` đúng khỏi `public`/`anon`/`authenticated`.
- Scheduler: ranh giới ngày 04:00, xử lý DST hai lượt, fuzz interval tách khỏi phần preview, ngân sách thẻ mới theo ngày. Tất cả đều có test và comment giải thích lý do.
- Migration có ghi chú "Data impact / Rollback". Việc dọn dữ liệu mồ côi được tách thành script opt-in.
- CI chặn merge bằng lint, typecheck, test và build. Baseline hiện tại sạch.

---

## 6. Thứ tự xử lý đề xuất

| # | Việc | Mục |
|---|---|---|
| 1 | Dialog xác nhận khi xoá deck + toast khi lỗi | 1.1 |
| 2 | RPC tổng hợp stats/progress (hoặc phân trang) | 1.2 |
| 3 | Sửa `nameSchema` | 2.6 |
| 4 | Helper `invokeGenerate` đọc body lỗi, bỏ retry ở `CreateDeck` | 2.3, 2.1 |
| 5 | Gate deploy sau CI | 2.8 |
| 6 | `npm audit fix` (zod), thay `xlsx` | 2.10 |
| 7 | Migration cho `profiles` + bucket `avatars` | 2.7 |
| 8 | Rate limit theo user, cache distractors | 2.2 |
| 9 | RPC `review_card` atomic | 2.5 |
| 10 | Hạ giới hạn PDF, test + `deno check` cho Edge Function | 2.4, 2.9 |
