const express = require('express');
require('dotenv').config();
const app = express();
const port = 3000;

const { enviarOTP, verificarOTP } = require('./otpService');
const { registrarUsuario } = require('./registroService');
const { guardarUsuarioPendiente, obtenerUsuarioPendiente, eliminarUsuarioPendiente } = require('./registroTemporal');

app.use(express.json());

// Paso 1: Recibir datos y enviar OTP (no registrar aún)
app.post('/solicitar-otp', async (req, res) => {
  const { nombre, correo, telefono, contrasena, id_rol } = req.body;

  if (!nombre || !correo || !contrasena || !id_rol) {
    return res.status(400).json({ mensaje: 'Faltan campos obligatorios' });
  }

  // Guardar temporalmente en memoria
  guardarUsuarioPendiente(correo, { nombre, correo, telefono, contrasena, id_rol });

  try {
    await enviarOTP(correo);
    res.json({ mensaje: 'Código OTP enviado al correo' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error enviando OTP' });
  }
});

// Paso 2: Verificar OTP y registrar
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

    res.json({ mensaje: 'Usuario registrado correctamente', id_usuario: resultado.id_usuario });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al verificar OTP y registrar' });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
