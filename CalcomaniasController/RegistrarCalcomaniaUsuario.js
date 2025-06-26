const pool = require('../db');

async function RegistrarCalcomaniaUsuario(req, res) {
  try {
    console.log("=== DEBUG BACKEND ===");
    console.log("req.body:", req.body);
    console.log("req.file:", req.file);
    console.log("req.user:", req.user);

    // Extraer datos del cuerpo de la solicitud
    const { nombre, precio_unidad, precio_descuento, stock_pequeno, stock_mediano, stock_grande } = req.body;
    const fk_id_usuario = req.user.id_usuario;

    console.log("=== DATOS EXTRAÍDOS ===");
    console.log("nombre:", nombre, "tipo:", typeof nombre);
    console.log("precio_unidad:", precio_unidad, "tipo:", typeof precio_unidad);
    console.log("precio_descuento:", precio_descuento, "tipo:", typeof precio_descuento);
    console.log("stock_pequeno:", stock_pequeno, "tipo:", typeof stock_pequeno);
    console.log("stock_mediano:", stock_mediano, "tipo:", typeof stock_mediano);
    console.log("stock_grande:", stock_grande, "tipo:", typeof stock_grande);
    console.log("fk_id_usuario:", fk_id_usuario);
    console.log("req.file?.path:", req.file?.path);

    // Validar datos requeridos básicos
    if (!nombre || !req.file?.path) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan datos requeridos: nombre o imagen.'
      });
    }

    // --- Procesamiento y validación de valores numéricos ---
    // parseFloat se usa para precios que pueden tener decimales
    // Si la conversión resulta en NaN, se asigna 0
    const parsed_precio_unidad = isNaN(parseFloat(precio_unidad)) ? 0 : parseFloat(precio_unidad);
    const parsed_precio_descuento = isNaN(parseFloat(precio_descuento)) ? 0 : parseFloat(precio_descuento);

    // parseInt se usa para stock que son números enteros, con base 10
    // Si la conversión resulta en NaN, se asigna 0
    const parsed_stock_pequeno = isNaN(parseInt(stock_pequeno, 10)) ? 0 : parseInt(stock_pequeno, 10);
    const parsed_stock_mediano = isNaN(parseInt(stock_mediano, 10)) ? 0 : parseInt(stock_mediano, 10);
    const parsed_stock_grande = isNaN(parseInt(stock_grande, 10)) ? 0 : parseInt(stock_grande, 10);

    // --- Verificación de usuario activo ---
    const [usuario] = await pool.execute(
      'SELECT id_usuario FROM usuario WHERE id_usuario = ? AND estado = 1',
      [fk_id_usuario]
    );

    if (usuario.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Usuario no encontrado o inactivo.'
      });
    }

    // --- Obtención de datos de la imagen ---
    const url_archivo = req.file.path;
    const formato = req.file.mimetype.split('/')[1]; // Extrae 'jpg', 'png', etc.
    const tamano_archivo = `${(req.file.size / 1024).toFixed(2)} KB`; // Convierte bytes a KB
    const fecha_subida = new Date().toISOString().split('T')[0]; // Fecha actual en formato ISO y solo la fecha

    // Definir tamaño_x y tamano_y como '5' (estos parecen ser valores fijos)
    const tamano_x = '5';
    const tamano_y = '5';

    // --- Inserción de la calcomanía en la base de datos ---
    const [result] = await pool.execute(
      `INSERT INTO calcomania (nombre, formato, tamano_archivo, fecha_subida, url_archivo, fk_id_usuario, estado, precio_unidad, precio_descuento, tamano_x, tamano_y, stock_pequeno, stock_mediano, stock_grande)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, formato, tamano_archivo, fecha_subida, url_archivo, fk_id_usuario, parsed_precio_unidad, parsed_precio_descuento, tamano_x, tamano_y, parsed_stock_pequeno, parsed_stock_mediano, parsed_stock_grande]
    );

    // --- Respuesta exitosa ---
    return res.status(201).json({
      success: true,
      mensaje: 'Calcomanía registrada exitosamente.',
      calcomania: {
        id_calcomania: result.insertId,
        nombre,
        formato,
        tamano_archivo,
        fecha_subida,
        url_archivo,
        fk_id_usuario,
        estado: true,
        precio_unidad: parsed_precio_unidad,
        precio_descuento: parsed_precio_descuento,
        tamano_x,
        tamano_y,
        stock_pequeno: parsed_stock_pequeno,
        stock_mediano: parsed_stock_mediano,
        stock_grande: parsed_stock_grande
      }
    });

  } catch (error) {
    console.error('Error registrando calcomanía:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor al registrar la calcomanía.'
    });
  }
}

module.exports = {
  RegistrarCalcomaniaUsuario
};