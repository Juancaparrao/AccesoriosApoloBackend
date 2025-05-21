const axios = require('axios');
const pool = require('../db');
const jwt = require('jsonwebtoken');

async function loginConFacebook(req, res) {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ mensaje: 'Falta el token de acceso de Facebook' });
  }

  try {
    // Obtener datos del usuario desde Facebook
    const fbResponse = await axios.get(`https://graph.facebook.com/me`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,email,picture'
      }
    });

    const { id, name, email, picture } = fbResponse.data;
    const fotoPerfil = picture?.data?.url || null;

    if (!email) {
      return res.status(400).json({ mensaje: 'No se pudo obtener el correo del usuario desde Facebook' });
    }

    // Verificar si ya existe el usuario
    const [usuarios] = await pool.execute('SELECT * FROM usuario WHERE correo = ?', [email]);

    let usuario;
    if (usuarios.length === 0) {
      // Registrar nuevo usuario sin contraseña ni cédula
      const [resultado] = await pool.execute(
        'INSERT INTO usuario (nombre, correo) VALUES (?, ?)',
        [name, email]
      );

      const idUsuario = resultado.insertId;

      // Asignar rol "cliente"
      await pool.execute(
        'INSERT INTO usuario_rol (fk_id_usuario, id_rol) VALUES (?, ?)',
        [idUsuario, 1] // Asegúrate que 1 es el rol cliente
      );

      usuario = { id_usuario: idUsuario, nombre: name, correo: email, foto: fotoPerfil };
    } else {
      usuario = usuarios[0];
      usuario.foto = fotoPerfil; // Añadimos la foto al objeto de respuesta
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        correo: usuario.correo
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({ mensaje: 'Autenticación exitosa', token, usuario });

  } catch (error) {
    console.error('Error en login con Facebook:', error.response?.data || error.message);
    res.status(500).json({ mensaje: 'Error en la autenticación con Facebook' });
  }
}

module.exports = { loginConFacebook };
