const axios = require('axios');
const pool = require('../db');

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
        fields: 'id,name,email'
      }
    });

    const { id, name, email } = fbResponse.data;

    if (!email) {
      return res.status(400).json({ mensaje: 'No se pudo obtener el correo del usuario desde Facebook' });
    }

    // Verificar si ya existe el usuario
    const [usuarios] = await pool.execute('SELECT * FROM usuario WHERE correo = ?', [email]);

    let usuario;
    if (usuarios.length === 0) {
      // Registrar nuevo usuario
      const [resultado] = await pool.execute(
        'INSERT INTO usuario (nombre, correo, id_rol) VALUES (?, ?, ?)',
        [name, email, 2] // Puedes ajustar el ID de rol predeterminado
      );

      usuario = { id_usuario: resultado.insertId, nombre: name, correo: email };
    } else {
      usuario = usuarios[0];
    }

    // Aquí puedes generar un JWT si usas tokens
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id_usuario: usuario.id_usuario, nombre: usuario.nombre, correo: usuario.correo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({ mensaje: 'Autenticación exitosa', token, usuario });

  } catch (error) {
    console.error('Error en login con Facebook:', error);
    res.status(500).json({ mensaje: 'Error en la autenticación con Facebook' });
  }
}

module.exports = { loginConFacebook };
