const pool = require('../db');

async function RegistrarCalcomania(req, res) {
  try {
    console.log("=== DEBUG BACKEND ===");
    console.log("req.body:", req.body);
    console.log("req.file:", req.file);
    console.log("req.user:", req.user);

    // Extraer datos del cuerpo de la solicitud
    // ¡CAMBIO AQUÍ! stock_pequeño ahora es stock_pequeno
    const { nombre, precio_unidad, precio_descuento, stock_pequeno, stock_mediano, stock_grande } = req.body;
    const fk_id_usuario = req.user.id_usuario;

    console.log("=== DATOS EXTRAÍDOS ===");
    console.log("nombre:", nombre, "tipo:", typeof nombre);
    console.log("precio_unidad:", precio_unidad, "tipo:", typeof precio_unidad);
    console.log("precio_descuento:", precio_descuento, "tipo:", typeof precio_descuento);
    // ¡CAMBIO AQUÍ! stock_pequeño ahora es stock_pequeno
    console.log("stock_pequeno:", stock_pequeno, "tipo:", typeof stock_pequeno);
    console.log("stock_mediano:", stock_mediano, "tipo:", typeof stock_mediano);
    console.log("stock_grande:", stock_grande, "tipo:", typeof stock_grande);
    console.log("fk_id_usuario:", fk_id_usuario);
    console.log("req.file?.path:", req.file?.path);

    // Validar datos requeridos
    if (!nombre || !req.file?.path || precio_unidad === undefined || precio_descuento === undefined ||
        // ¡CAMBIO AQUÍ! stock_pequeño ahora es stock_pequeno
        stock_pequeno === undefined || stock_mediano === undefined || stock_grande === undefined) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan datos requeridos: nombre, imagen, precio_unidad, precio_descuento o valores de stock.'
      });
    }

    // Parsear los valores numéricos de string a number
    // parseFloat se usa para precios que pueden tener decimales
    const parsed_precio_unidad = parseFloat(precio_unidad);
    const parsed_precio_descuento = parseFloat(precio_descuento);
    // parseInt se usa para stock que son números enteros, con base 10
    // ¡CAMBIO AQUÍ! stock_pequeño ahora es stock_pequeno
    const parsed_stock_pequeno = parseInt(stock_pequeno, 10);
    const parsed_stock_mediano = parseInt(stock_mediano, 10);
    const parsed_stock_grande = parseInt(stock_grande, 10);

    // Validar que los valores parseados sean números válidos
    if (isNaN(parsed_precio_unidad) || isNaN(parsed_precio_descuento) ||
        // ¡CAMBIO AQUÍ! stock_pequeño ahora es stock_pequeno
        isNaN(parsed_stock_pequeno) || isNaN(parsed_stock_mediano) || isNaN(parsed_stock_grande)) {
      return res.status(400).json({
        success: false,
        mensaje: 'Los valores de precio y stock deben ser números válidos.'
      });
    }

    // Verificar que el usuario del token existe y está activo
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

    // Obtener datos de la imagen desde Cloudinary
    const url_archivo = req.file.path;
    const formato = req.file.mimetype.split('/')[1]; // Extrae 'jpg', 'png', etc.
    const tamano_archivo = `${(req.file.size / 1024).toFixed(2)} KB`; // Convierte bytes a KB
    const fecha_subida = new Date().toISOString().split('T')[0]; // Fecha actual en formato ISO y solo la fecha

    // Definir tamaño_x y tamano_y como '5'
    const tamano_x = '5';
    const tamano_y = '5';

    // Insertar la calcomanía en la base de datos, usando los valores parseados
    // ¡CAMBIO AQUÍ! stock_pequeño ahora es stock_pequeno en la consulta SQL
    const [result] = await pool.execute(
      `INSERT INTO calcomania (nombre, formato, tamano_archivo, fecha_subida, url_archivo, fk_id_usuario, estado, precio_unidad, precio_descuento, tamano_x, tamano_y, stock_pequeno, stock_mediano, stock_grande)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, formato, tamano_archivo, fecha_subida, url_archivo, fk_id_usuario, parsed_precio_unidad, parsed_precio_descuento, tamano_x, tamano_y, parsed_stock_pequeno, parsed_stock_mediano, parsed_stock_grande]
    );

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
        precio_unidad: parsed_precio_unidad, // Devolver los valores parseados
        precio_descuento: parsed_precio_descuento, // Devolver los valores parseados
        tamano_x,
        tamano_y,
        // ¡CAMBIO AQUÍ! stock_pequeño ahora es stock_pequeno
        stock_pequeno: parsed_stock_pequeno, // Devolver los valores parseados
        stock_mediano: parsed_stock_mediano, // Devolver los valores parseados
        stock_grande: parsed_stock_grande // Devolver los valores parseados
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
  RegistrarCalcomania
};