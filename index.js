const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = 3000;
const {solicitarRecuperacion, cambiarContrasena } = require('./InicioController/RecuperarContrasena');
const { solicitarOTP, reenviarOTP, verificarOTPHandler } = require('./InicioController/OTP');
const { login } = require('./InicioController/Login');
const { obtenerNombre } = require('./InicioController/GeneralInicio');
const { verificarToken } = require('./InicioController/middleware');
const { loginConGoogle } = require('./InicioController/GoogleAuth');
const { loginConFacebook } = require('./InicioController/FacebookAuth');
const { obtenerPerfil } = require('./InicioController/Perfil');

app.use(cors({
  origin: ['http://localhost:5173', 'https://accesorios-apolo-frontend.vercel.app'],
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
app.get('/perfil', verificarToken, obtenerPerfil);

// Recuperar contraseña
app.post('/recuperar', solicitarRecuperacion);
app.post('/cambiar-contrasena', cambiarContrasena);

// Ruta de login con Google
app.post('/login-google', loginConGoogle);

// Ruta de login con Facebook
app.post('/auth/facebook', loginConFacebook);

// Inicializar servidor
app.listen(port, () => {
  console.log(`✅ Servidor corriendo`);
});
