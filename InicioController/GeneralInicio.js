const pool = require('../db');
const bcrypt = require('bcrypt');

async function obtenerNombre(req, res) {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
  try {
    const [rows] = await pool.execute('SELECT * FROM USUARIO WHERE correo = ?', [correo]);
    if (rows.length === 0) return res.status(401).json({ mensaje: 'Usuario no encontrado' });
    const usuario = rows[0];
    const esValida = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!esValida) return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    res.json({ nombre: usuario.nombre });
  } catch (error) {
    console.error('Error en /obtener-nombre:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
}

module.exports = { obtenerNombre };