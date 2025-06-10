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
    // Verificar el token de Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;
    
    console.log('Datos de Google:', { email, name, picture });
    
    // Verificar si el usuario ya existe
    const [usuarios] = await pool.execute(
      'SELECT u.*, ur.id_rol, r.nombre as nombre_rol FROM usuario u LEFT JOIN usuario_rol ur ON u.id_usuario = ur.fk_id_usuario LEFT JOIN rol r ON ur.id_rol = r.id_rol WHERE u.correo = ?',
      [email]
    );
    
    let usuario;
    let esNuevoUsuario = false;
    
    if (usuarios.length > 0) {
      // Usuario existente - actualizar nombre si cambió
      usuario = usuarios[0];
      
      if (usuario.nombre !== name) {
        await pool.execute(
          'UPDATE usuario SET nombre = ? WHERE id_usuario = ?',
          [name, usuario.id_usuario]
        );
        usuario.nombre = name;
      }
      
      console.log('Usuario existente encontrado:', usuario.id_usuario);
    } else {
      // Nuevo usuario - registrar automáticamente
      esNuevoUsuario = true;
      
      const [result] = await pool.execute(
        'INSERT INTO usuario (nombre, correo, estado) VALUES (?, ?, ?)',
        [name, email, true]
      );
      
      const nuevoUsarioId = result.insertId;
      
      // Asignar rol por defecto (cliente)
      const rolPorDefecto = 1;
      await pool.execute(
        'INSERT INTO usuario_rol (fk_id_usuario, id_rol) VALUES (?, ?)',
        [nuevoUsarioId, rolPorDefecto]
      );
      
      // Obtener información completa del nuevo usuario
      const [nuevoUsuario] = await pool.execute(
        'SELECT u.*, ur.id_rol, r.nombre as nombre_rol FROM usuario u LEFT JOIN usuario_rol ur ON u.id_usuario = ur.fk_id_usuario LEFT JOIN rol r ON ur.id_rol = r.id_rol WHERE u.id_usuario = ?',
        [nuevoUsarioId]
      );
      
      usuario = nuevoUsuario[0];
      console.log('Nuevo usuario registrado:', usuario.id_usuario);
    }
    
    // Generar token JWT con toda la información necesaria
    const tokenBackend = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        correo: usuario.correo,
        nombre: usuario.nombre,
        foto: picture, // La foto viene de Google, no de la BD
        rol: usuario.id_rol || 1,
        nombreRol: usuario.nombre_rol || 'cliente',
        esNuevoUsuario
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    // Respuesta exitosa
    res.status(200).json({
      mensaje: esNuevoUsuario 
        ? 'Registro con Google exitoso - Sesión iniciada automáticamente' 
        : 'Inicio de sesión con Google exitoso',
      token: tokenBackend,
      usuario: {
        id_usuario: usuario.id_usuario,
        correo: usuario.correo,
        nombre: usuario.nombre,
        foto: picture, // La foto viene de Google, no de la BD
        rol: usuario.id_rol || 1,
        nombreRol: usuario.nombre_rol || 'cliente',
        esNuevoUsuario
      },
      success: true
    });
    
  } catch (error) {
    console.error('Error en autenticación con Google:', error);
    
    // Respuesta de error más detallada
    if (error.message.includes('Token used too late')) {
      res.status(401).json({ 
        mensaje: 'Token de Google expirado',
        error: 'TOKEN_EXPIRED',
        success: false
      });
    } else if (error.message.includes('Invalid token')) {
      res.status(401).json({ 
        mensaje: 'Token de Google inválido',
        error: 'INVALID_TOKEN',
        success: false
      });
    } else {
      res.status(500).json({ 
        mensaje: 'Error interno del servidor',
        error: 'SERVER_ERROR',
        success: false
      });
    }
  }
}

module.exports = { loginConGoogle };