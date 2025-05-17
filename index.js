const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = 3000;

const { solicitarOTP, reenviarOTP, verificarOTPHandler } = require('./InicioController/OTP');
const { login } = require('./InicioController/Login');
const { obtenerNombre } = require('./InicioController/GeneralInicio');
const { verificarToken } = require('./InicioController/middleware');

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Rutas de registro con OTP
app.post('/solicitar-otp', solicitarOTP);
app.post('/reenviar-otp', reenviarOTP);
app.post('/verificar-otp', verificarOTPHandler);

// Ruta de login
app.post('/login', login);

// Ruta para obtener nombre del usuario
app.post('/obtener-nombre', obtenerNombre);

// Ruta protegida con JWT
app.get('/perfil', verificarToken, (req, res) => {
  res.json({ mensaje: 'Acceso permitido', usuario: req.user });
});

// Inicializar servidor
app.listen(port, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${port}`);
});
