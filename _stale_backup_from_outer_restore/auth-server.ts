import express from 'express';
import cors from 'cors';
import authRoutes from './auth/routes.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use('/', authRoutes);

app.listen(PORT, () => {
  console.log(`✅ Auth server running on http://localhost:${PORT}`);
  console.log(`🔐 Login API: http://localhost:${PORT}/api/auth/login`);
});
