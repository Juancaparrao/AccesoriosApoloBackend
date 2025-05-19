const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // desde Google Cloud Console
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
    const { email, name } = payload;

    // Verifica si ya existe
    const [usuarios] = await pool.execute('SELECT * FROM USUARIO WHERE correo = ?', [email]);

    let id_usuario;
    if (usuarios.length > 0) {
      id_usuario = usuarios[0].id_usuario;
    } else {
      // Insertar solo nombre y correo, sin teléfono ni contraseña
      const [result] = await pool.execute(
        'INSERT INTO USUARIO (nombre, correo) VALUES (?, ?)',
        [name, email]
      );
      id_usuario = result.insertId;

      // Insertar rol por defecto en la tabla intermedia
      const rolPorDefecto = 1;
      await pool.execute(
        'INSERT INTO USUARIO_ROL (fk_id_usuario, id_rol) VALUES (?, ?)',
        [id_usuario, rolPorDefecto]
      );
    }


    // Crea el JWT
    const tokenBackend = jwt.sign(
      { id_usuario, correo: email, nombre: name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      mensaje: 'Autenticación con Google exitosa',
      token: tokenBackend,
      usuario: { id_usuario, correo: email, nombre: name }
    });

  } catch (error) {
    console.error('Error en autenticación con Google:', error);
    res.status(401).json({ mensaje: 'Token de Google inválido' });
  }
}

module.exports = { loginConGoogle };