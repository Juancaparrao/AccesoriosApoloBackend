const pool = require('../db');
const bcrypt = require('bcrypt');

async function registrarUsuarioDirecto(req, res) {
  try {
    const { cedula, nombre, telefono, correo, rol, contrasena } = req.body;

    if (!cedula || !nombre || !correo || !rol || !contrasena) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan campos obligatorios.'
      });
    }

    const rolesMap = {
      Cliente: 1,
      Gerente: 2,
      Vendedor: 3
    };

    const idRol = rolesMap[rol];

    // Validar si el correo ya existe
    const [usuarios] = await pool.execute(
      'SELECT id_usuario FROM usuario WHERE correo = ?',
      [correo]
    );

    if (usuarios.length > 0) {
      return res.status(409).json({
        success: false,
        mensaje: 'Este correo ya está registrado.'
      });
    }

    const hash = await bcrypt.hash(contrasena, 10);

    // Insertar en usuario con cédula
    const [result] = await pool.execute(
      'INSERT INTO usuario (cedula, nombre, telefono, correo, contrasena) VALUES (?, ?, ?, ?, ?)',
      [cedula, nombre, telefono, correo, hash]
    );

    const idUsuario = result.insertId;

    await pool.execute(
      'INSERT INTO usuario_rol (fk_id_usuario, id_rol) VALUES (?, ?)',
      [idUsuario, idRol]
    );

    return res.status(201).json({
      success: true,
      mensaje: 'Usuario registrado exitosamente.'
    });

  } catch (error) {
    console.error('Error al registrar usuario:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al registrar el usuario.'
    });
  }
}

module.exports = { registrarUsuarioDirecto };
