const pool = require('../db');
const bcrypt = require('bcrypt');
const transporter = require('../InicioController/config/mailer');

async function obtenerDatosUsuario(req, res) {
  try {
    const { correo } = req.body;

    const [rows] = await pool.execute(
      `SELECT u.nombre, u.correo, u.telefono, u.cedula, r.nombre AS rol
       FROM usuario u
       JOIN usuario_rol ur ON u.id_usuario = ur.fk_id_usuario
       JOIN rol r ON ur.id_rol = r.id_rol
       WHERE u.correo = ?`,
      [correo]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      usuario: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener datos del usuario:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al obtener los datos'
    });
  }
}

async function actualizarUsuario(req, res) {
  const {
    correoOriginal,
    nombre,
    correo,
    telefono,
    cedula,
    contrasena,
    rol,
    enviarContrasena
  } = req.body;

  if (!telefono || telefono.trim() === "") {
    return res.status(400).json({
      success: false,
      mensaje: 'El teléfono es obligatorio.'
    });
  }

  try {
    const [usuarioActual] = await pool.execute(
      'SELECT id_usuario, contrasena FROM usuario WHERE correo = ?',
      [correoOriginal]
    );

    if (usuarioActual.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    const id_usuario = usuarioActual[0].id_usuario;

    const [correoExistente] = await pool.execute(
      'SELECT id_usuario FROM usuario WHERE correo = ? AND id_usuario != ?',
      [correo, id_usuario]
    );

    const [cedulaExistente] = await pool.execute(
      'SELECT id_usuario FROM usuario WHERE cedula = ? AND id_usuario != ?',
      [cedula, id_usuario]
    );

    const [telefonoExistente] = await pool.execute(
      'SELECT id_usuario FROM usuario WHERE telefono = ? AND id_usuario != ?',
      [telefono, id_usuario]
    );

    if (correoExistente.length > 0) {
      return res.status(409).json({ success: false, mensaje: 'Ese correo ya está en uso.' });
    }

    if (cedulaExistente.length > 0) {
      return res.status(409).json({ success: false, mensaje: 'Esa cédula ya está registrada.' });
    }

    if (telefonoExistente.length > 0) {
      return res.status(409).json({ success: false, mensaje: 'Ese teléfono ya está registrado.' });
    }

    const [rolData] = await pool.execute('SELECT id_rol FROM rol WHERE nombre = ?', [rol]);

    if (rolData.length === 0) {
      return res.status(400).json({ success: false, mensaje: 'Rol no válido.' });
    }

    const nuevoRolId = rolData[0].id_rol;
    let contrasenaParaEnviar = null;

    if (rol === 'cliente') {
      await pool.execute(
        `UPDATE usuario SET nombre = ?, correo = ?, telefono = ?, cedula = ?
         WHERE id_usuario = ?`,
        [nombre, correo, telefono, cedula, id_usuario]
      );

      if (enviarContrasena === true || enviarContrasena === 'true') {
        contrasenaParaEnviar = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contrasenaParaEnviar, salt);

        await pool.execute(
          `UPDATE usuario SET contrasena = ? WHERE id_usuario = ?`,
          [hashedPassword, id_usuario]
        );
      }
    } else if (rol === 'vendedor') {
      if (contrasena && contrasena.trim() !== "") {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contrasena, salt);

        await pool.execute(
          `UPDATE usuario SET nombre = ?, correo = ?, telefono = ?, cedula = ?, contrasena = ?
           WHERE id_usuario = ?`,
          [nombre, correo, telefono, cedula, hashedPassword, id_usuario]
        );

        contrasenaParaEnviar = contrasena;
      } else {
        await pool.execute(
          `UPDATE usuario SET nombre = ?, correo = ?, telefono = ?, cedula = ?
           WHERE id_usuario = ?`,
          [nombre, correo, telefono, cedula, id_usuario]
        );
      }
    } else if (rol === 'gerente') {
      if (contrasena && contrasena.trim() !== "") {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contrasena, salt);

        await pool.execute(
          `UPDATE usuario SET nombre = ?, correo = ?, telefono = ?, cedula = ?, contrasena = ?
           WHERE id_usuario = ?`,
          [nombre, correo, telefono, cedula, hashedPassword, id_usuario]
        );
      } else {
        await pool.execute(
          `UPDATE usuario SET nombre = ?, correo = ?, telefono = ?, cedula = ?
           WHERE id_usuario = ?`,
          [nombre, correo, telefono, cedula, id_usuario]
        );
      }
    }

    await pool.execute(
      `UPDATE usuario_rol SET id_rol = ? WHERE fk_id_usuario = ?`,
      [nuevoRolId, id_usuario]
    );

    if (contrasenaParaEnviar) {
      try {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: correo,
          subject: 'Actualización de contraseña - Sistema',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Actualización de Usuario</h2>
              <p>Hola <strong>${nombre}</strong>,</p>
              <p>Tu usuario ha sido actualizado exitosamente. A continuación encontrarás tu información de acceso:</p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Correo:</strong> ${correo}</p>
                <p><strong>Contraseña:</strong> ${contrasenaParaEnviar}</p>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Por seguridad, te recomendamos cambiar tu contraseña después del primer inicio de sesión.
              </p>
              
              <p>Saludos,<br>El equipo de administración</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log('Correo enviado exitosamente a:', correo);
      } catch (emailError) {
        console.error('Error al enviar correo:', emailError);
      }
    }

    return res.status(200).json({
      success: true,
      mensaje: contrasenaParaEnviar 
        ? 'Usuario actualizado correctamente. Se ha enviado la contraseña por correo.' 
        : 'Usuario actualizado correctamente.'
    });

  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al actualizar el usuario'
    });
  }
}

module.exports = { obtenerDatosUsuario, actualizarUsuario };
