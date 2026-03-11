# Grocery E-Commerce Website (Level 3)

Full-stack e-commerce project with:
- User authentication (register/login with JWT)
- Product browsing + filtering/sorting
- Add/update/remove cart items
- Checkout flow with payment method selection (`COD`, `Card`, `UPI`)
- Order history
- Admin product management (create/edit/delete + image upload)

## Tech Stack
- Frontend: HTML/CSS/JavaScript (static hosting ready)
- Backend: Node.js + Express
- Database: MongoDB (Mongoose)

## Project Structure
- `frontend/` static client
- `backend/` API server + models + auth middleware

## Local Setup
1. Backend setup:
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
2. Frontend setup:
- Open `frontend/index.html` with Live Server (or any static server).
- If backend is not `http://localhost:5000`, edit `frontend/config.js`:
```js
window.API_BASE_URL = "https://your-backend-url";
```

## Environment Variables (`backend/.env`)
```env
MONGO_URI=mongodb://127.0.0.1:27017/grocerydb
JWT_SECRET=replace-with-strong-random-secret
ADMIN_EMAIL=admin@example.com
PORT=5000
```

## Deployment (Free Hosting)
### Option A: Frontend on Netlify + Backend on Render/Railway
1. Push code to GitLab/GitHub.
2. Deploy `backend/` as a Node service.
3. Set backend env vars: `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `PORT`.
4. Deploy `frontend/` as static site.
5. Update `frontend/config.js` with deployed backend URL.

### Option B: Frontend on GitHub Pages
1. Host `frontend/` on GitHub Pages.
2. Host backend on Render/Railway/Heroku alternative.
3. Set `window.API_BASE_URL` to backend URL.

## Notes
- `frontend/app.js` was removed (legacy file not used by current pages).
- Cart checkout records payment metadata in orders:
  - `paymentMethod`: `cod` | `card` | `upi`
  - `paymentStatus`: `pending` (COD) or `paid` (Card/UPI)
