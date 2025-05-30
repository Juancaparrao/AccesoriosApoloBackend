const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

async function loginConGoogle(req, res) {
  const { token } = req.body;

  console.log('CLIENT_ID:', CLIENT_ID);
  console.log('Token recibido:', token);

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // Verifica si ya existe
    const [usuarios] = await pool.execute(
      'SELECT * FROM usuario WHERE correo = ?',
      [email]
    );

    let id_usuario;
    if (usuarios.length > 0) {
      id_usuario = usuarios[0].id_usuario;
    } else {
      // Insertar nombre, correo y estado (obligatorio)
      const [result] = await pool.execute(
        'INSERT INTO usuario (nombre, correo, estado) VALUES (?, ?, ?)',
        [name, email, true]
      );
      id_usuario = result.insertId;

      const rolPorDefecto = 1; // cliente
      await pool.execute(
        'INSERT INTO usuario_rol (fk_id_usuario, id_rol) VALUES (?, ?)',
        [id_usuario, rolPorDefecto]
      );
    }

    // Creamos el token incluyendo la foto (opcional)
    const tokenBackend = jwt.sign(
      {
        id_usuario,
        correo: email,
        nombre: name,
        foto: picture,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      mensaje: 'Autenticación con Google exitosa',
      token: tokenBackend,
      usuario: {
        id_usuario,
        correo: email,
        nombre: name,
        foto: picture,
      },
    });

  } catch (error) {
    console.error('Error en autenticación con Google:', error);
    res.status(401).json({ mensaje: 'Token de Google inválido' });
  }
}

module.exports = { loginConGoogle };
