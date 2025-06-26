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
    //    Esto actualiza los detalles de la calcomanía maestra, no el ítem del carrito
    const [updateResultCalcomania] = await pool.execute(
      `UPDATE calcomania
       SET tamano_x = ?, tamano_y = ?, precio_unidad = ?
       WHERE id_calcomania = ?`,
      [parsed_tamano_x, parsed_tamano_y, nuevo_precio_unidad, id_calcomania]
    );

    if (updateResultCalcomania.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Calcomanía no encontrada o no se pudo actualizar en la tabla maestra.'
      });
    }

    // 5. Verificar si la calcomanía ya existe en el carrito del usuario con los mismos atributos
    const [existingItem] = await pool.execute(
      `SELECT id_carrito, cantidad
       FROM CARRITO_COMPRAS
       WHERE FK_id_usuario = ?
       AND FK_id_calcomania = ?
       AND FK_referencia_producto IS NULL`, // Importante: Aseguramos que sea el registro de la calcomanía
      [fk_id_usuario, id_calcomania]
    );

    let carritoResult;
    let mensajeRespuesta = 'Calcomanía agregada al carrito exitosamente.';

    if (existingItem.length > 0) {
      // 6. Si la calcomanía ya existe, actualizar la cantidad
      const currentQuantity = existingItem[0].cantidad;
      const id_carrito_existente = existingItem[0].id_carrito;
      const newQuantity = currentQuantity + 1;

      [carritoResult] = await pool.execute(
        `UPDATE CARRITO_COMPRAS
         SET cantidad = ?
         WHERE id_carrito = ?`,
        [newQuantity, id_carrito_existente]
      );
      mensajeRespuesta = 'Cantidad de calcomanía actualizada en el carrito.';
    } else {
      // 7. Si la calcomanía NO existe, insertarla como un nuevo ítem
      const fecha_adicion = new Date().toISOString().split('T')[0];
      const cantidad = 1;
      const FK_referencia_producto_a_insertar = null; // Siempre NULL para calcomanías
      const FK_id_calcomania_a_insertar = id_calcomania;

      [carritoResult] = await pool.execute(
        `INSERT INTO carrito_compras (fk_id_usuario, FK_referencia_producto, fk_id_calcomania, cantidad, fecha_adicion)
         VALUES (?, ?, ?, ?, ?)`,
        [fk_id_usuario, FK_referencia_producto_a_insertar, FK_id_calcomania_a_insertar, cantidad, fecha_adicion]
      );
    }

    return res.status(200).json({
      success: true,
      mensaje: mensajeRespuesta,
      calcomania_actualizada: {
        id_calcomania: id_calcomania,
        tamano_x: parsed_tamano_x,
        tamano_y: parsed_tamano_y,
        precio_unidad: nuevo_precio_unidad
      },
      // Devuelve información relevante sobre el ítem del carrito (ya sea nuevo o actualizado)
      carrito_item_id: existingItem.length > 0 ? existingItem[0].id_carrito : carritoResult.insertId,
      cantidad_actualizada: existingItem.length > 0 ? existingItem[0].cantidad + 1 : 1
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