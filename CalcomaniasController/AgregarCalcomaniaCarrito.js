const pool = require('../db');

async function AgregarCalcomaniaCarrito(req, res) {
  try {
    console.log("=== DEBUG BACKEND - Actualizar Calcomanía y Carrito ===");
    console.log("req.body:", req.body);
    console.log("req.user:", req.user); // Información del usuario desde el token

    const { id_calcomania, tamano_x_nuevo, tamano_y_nuevo } = req.body;
    const fk_id_usuario = req.user.id_usuario; // ID del usuario del token

    // 1. Validar datos requeridos
    if (!id_calcomania || tamano_x_nuevo === undefined || tamano_y_nuevo === undefined) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan datos requeridos: id_calcomania, tamano_x_nuevo o tamano_y_nuevo.'
      });
    }

    // 2. Parsear y validar los nuevos tamaños
    const parsed_tamano_x = parseInt(tamano_x_nuevo, 10);
    const parsed_tamano_y = parseInt(tamano_y_nuevo, 10);

    if (isNaN(parsed_tamano_x) || isNaN(parsed_tamano_y)) {
      return res.status(400).json({
        success: false,
        mensaje: 'Los valores de tamaño deben ser números válidos.'
      });
    }

    // Validar rangos de tamaño
    const MIN_TAMANO = 5;
    const MAX_TAMANO_X = 20;
    const MAX_TAMANO_Y = 30;
    const PRECIO_POR_CM = 500;

    if (parsed_tamano_x < MIN_TAMANO || parsed_tamano_x > MAX_TAMANO_X ||
        parsed_tamano_y < MIN_TAMANO || parsed_tamano_y > MAX_TAMANO_Y) {
      return res.status(400).json({
        success: false,
        mensaje: `Los tamaños deben estar dentro de los rangos permitidos: X entre ${MIN_TAMANO}-${MAX_TAMANO_X} y Y entre ${MIN_TAMANO}-${MAX_TAMANO_Y}.`
      });
    }

    // 3. Calcular el nuevo precio_unidad basado en el tamaño
    const nuevo_precio_unidad = (parsed_tamano_x * PRECIO_POR_CM) + (parsed_tamano_y * PRECIO_POR_CM);

    // 4. Actualizar la calcomanía en la tabla 'calcomania'
    const [updateResult] = await pool.execute(
      `UPDATE calcomania
       SET tamano_x = ?, tamano_y = ?, precio_unidad = ?
       WHERE id_calcomania = ?`,
      [parsed_tamano_x, parsed_tamano_y, nuevo_precio_unidad, id_calcomania]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Calcomanía no encontrada o no se pudo actualizar.'
      });
    }

    // 5. Agregar la calcomanía al 'carrito_compras'
    const fecha_adicion = new Date().toISOString().split('T')[0]; // Fecha actual
    const cantidad = 1; // Cantidad fija a 1 para esta operación

    // ¡CAMBIO CLAVE AQUÍ!
    // Usamos 'FK_referencia_producto' como en tu tabla
    // Y el valor '0' se envía como STRING porque la columna es VARCHAR.
    const FK_referencia_producto = '0';

    const [carritoResult] = await pool.execute(
      `INSERT INTO carrito_compras (fk_id_usuario, FK_referencia_producto, fk_id_calcomania, cantidad, fecha_adicion)
       VALUES (?, ?, ?, ?, ?)`,
      [fk_id_usuario, FK_referencia_producto, id_calcomania, cantidad, fecha_adicion]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Calcomanía actualizada y agregada al carrito exitosamente.',
      calcomania_actualizada: {
        id_calcomania: id_calcomania,
        tamano_x: parsed_tamano_x,
        tamano_y: parsed_tamano_y,
        precio_unidad: nuevo_precio_unidad
      },
      carrito_item: {
        id_carrito_item: carritoResult.insertId,
        fk_id_usuario: fk_id_usuario,
        FK_referencia_producto: FK_referencia_producto, // Devolvemos el valor usado
        fk_id_calcomania: id_calcomania,
        cantidad: cantidad,
        fecha_adicion: fecha_adicion
      }
    });

  } catch (error) {
    console.error('Error al actualizar calcomanía y agregar al carrito:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor al procesar la solicitud.'
    });
  }
}

module.exports = {
  AgregarCalcomaniaCarrito
};