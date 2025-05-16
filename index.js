const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('./db');
const bcrypt = require('bcrypt');


const { enviarOTP, verificarOTP } = require('./otpService');
const { registrarUsuario } = require('./registroService');
const { guardarUsuarioPendiente, obtenerUsuarioPendiente, eliminarUsuarioPendiente } = require('./registroTemporal');
const { iniciarSesion } = require('./authService');
const { verificarToken } = require('./middleware');

const app = express();
const port = 3000;

app.use(cors({
  origin: 'http://localhost:5173', // o el dominio del frontend si está desplegado
  credentials: true
}));

app.use(cors());
app.use(express.json());

// Paso 1: Recibir datos y enviar OTP (no registrar aún)
app.post('/solicitar-otp', async (req, res) => {
  const { nombre, correo, telefono, contrasena, id_rol } = req.body;

  if (!nombre || !correo || !contrasena || !id_rol) {
    return res.status(400).json({ mensaje: 'Faltan campos obligatorios' });
  }

  try {
    guardarUsuarioPendiente(correo, { nombre, correo, telefono, contrasena, id_rol });
    await enviarOTP(correo);
    res.json({ mensaje: 'Código OTP enviado al correo' });
  } catch (error) {
    console.error('Error al solicitar OTP:', error);
    res.status(500).json({ mensaje: 'Error enviando OTP' });
  }
});

app.post('/reenviar-otp', async (req, res) => {
  const { correo } = req.body;

  if (!correo) {
    return res.status(400).json({ error: 'El correo es obligatorio.' });
  }

  try {
    await enviarOTP(correo);
    res.status(200).json({ message: 'Código reenviado con éxito.' });
  } catch (error) {
    console.error('Error al reenviar OTP:', error);
    res.status(500).json({ error: 'Error al reenviar el código.' });
  }
});



app.post('/verificar-otp', async (req, res) => {
  const { correo, codigo_otp } = req.body;

  try {
    const valido = await verificarOTP(correo, codigo_otp);
    if (!valido) {
      return res.status(400).json({ mensaje: 'OTP inválido o expirado' });
    }

    const datos = obtenerUsuarioPendiente(correo);
    if (!datos) {
      return res.status(400).json({ mensaje: 'No hay datos pendientes para este correo' });
    }

    const resultado = await registrarUsuario(
      datos.nombre,
      datos.correo,
      datos.telefono,
      datos.contrasena,
      datos.id_rol
    );

    eliminarUsuarioPendiente(correo);

    // 🔐 Generar token JWT automáticamente
    const payload = {
      id_usuario: resultado.id_usuario,
      correo: datos.correo,
      nombre: datos.nombre
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
    });

    res.json({
      mensaje: 'Usuario registrado y sesión iniciada',
      token,
      usuario: payload
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al verificar OTP y registrar' });
  }
});


// Login con JWT
app.post('/login', async (req, res) => {
  const { correo, contrasena } = req.body;

  try {
    const { token, usuario } = await iniciarSesion(correo, contrasena);
    res.json({ mensaje: 'Login exitoso', token, usuario });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(401).json({ mensaje: error.message });
  }
});

app.post('/obtener-nombre', async (req, res) => {
  const { correo, contrasena } = req.body;

  if (!correo || !contrasena) {
    return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM USUARIO WHERE correo = ?',
      [correo]
    );

    if (rows.length === 0) {
      return res.status(401).json({ mensaje: 'Usuario no encontrado' });
    }

    const usuario = rows[0];

    const esValida = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!esValida) {
      return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    }

    res.json({ nombre: usuario.nombre });
  } catch (error) {
    console.error('Error en /obtener-nombre:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// Ruta protegida con JWT
app.get('/perfil', verificarToken, (req, res) => {
  res.json({ mensaje: 'Acceso permitido', usuario: req.user });
});

// Inicializar servidor
app.listen(port, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${port}`);
});
