const pool = require('../db');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { generarHtmlContrasena } = require('../InicioController/templates/RegistrarUsuarioDirectoCorreo');

// Función para generar contraseña segura
function generarContrasenaSegura() {
  const minusculas = 'abcdefghijklmnopqrstuvwxyz';
  const mayusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numeros = '0123456789';
  const simbolos = '!@#$%&*';
  
  let contrasena = '';
  
  // Asegurar al menos 1 mayúscula
  contrasena += mayusculas.charAt(Math.floor(Math.random() * mayusculas.length));
  
  // Asegurar al menos 1 número
  contrasena += numeros.charAt(Math.floor(Math.random() * numeros.length));
  
  // Completar hasta 8 caracteres con caracteres aleatorios
  const todosCaracteres = minusculas + mayusculas + numeros + simbolos;
  for (let i = contrasena.length; i < 8; i++) {
    contrasena += todosCaracteres.charAt(Math.floor(Math.random() * todosCaracteres.length));
  }
  
  // Mezclar la contraseña para que no siempre tenga el mismo patrón
  return contrasena.split('').sort(() => Math.random() - 0.5).join('');
}

// Configuración del transporter de nodemailer
const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true para 465, false para otros puertos
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function registrarUsuarioDirecto(req, res) {
  try {
    const { cedula, nombre, telefono, correo, rol } = req.body;

    // Validar campos obligatorios (ya no incluye contraseña)
    if (!cedula || !nombre || !correo || !rol) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan campos obligatorios: cédula, nombre, correo y rol son requeridos.'
      });
    }

    const rolesMap = {
      Cliente: 1,
      Gerente: 2,
      Vendedor: 3
    };

    const idRol = rolesMap[rol];

    if (!idRol) {
      return res.status(400).json({
        success: false,
        mensaje: 'Rol no válido. Los roles permitidos son: Cliente, Gerente, Vendedor.'
      });
    }

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

    // Generar contraseña automática
    const contrasenaGenerada = generarContrasenaSegura();
    const hash = await bcrypt.hash(contrasenaGenerada, 10);

    // Insertar en usuario con estado = true
    const [result] = await pool.execute(
      'INSERT INTO usuario (cedula, nombre, telefono, correo, contrasena, estado) VALUES (?, ?, ?, ?, ?, ?)',
      [cedula, nombre, telefono, correo, hash, true]
    );

    const idUsuario = result.insertId;

    // Insertar rol del usuario
    await pool.execute(
      'INSERT INTO usuario_rol (fk_id_usuario, id_rol) VALUES (?, ?)',
      [idUsuario, idRol]
    );

    // Enviar correo con la contraseña
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: correo,
      subject: '¡Bienvenido a Accesorios Apolo - Datos de acceso!',
      html: generarHtmlContrasena(nombre, contrasenaGenerada)
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Correo de bienvenida enviado a: ${correo}`);
    } catch (emailError) {
      console.error('Error al enviar correo:', emailError);
      // Opcional: podrías decidir si eliminar el usuario creado si falla el envío del correo
      // o simplemente registrar el error y continuar
    }

    return res.status(201).json({
      success: true,
      mensaje: 'Usuario registrado exitosamente. Se ha enviado un correo con los datos de acceso.',
      usuario: {
        id: idUsuario,
        nombre,
        correo,
        rol,
        estado: 'Activo'
      }
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