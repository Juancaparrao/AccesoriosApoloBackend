const pool = require('../db');

/**
 * Elimina un producto o calcomanía específica del carrito de compras de un usuario.
 * @param {object} req - Objeto de solicitud (request) de Express.
 * @param {object} res - Objeto de respuesta (response) de Express.
 */
async function EliminarItemCarrito(req, res) {
  try {
    console.log("=== DEBUG BACKEND - Eliminar Ítem del Carrito ===");
    console.log("req.body:", req.body);
    console.log("req.user:", req.user); // Información del usuario desde el token

    const { id_carrito_item } = req.body; // Esperamos el ID único del ítem en la tabla CARRITO_COMPRAS
    const fk_id_usuario = req.user.id_usuario; // ID del usuario desde el token

    // 1. Validar que el ID del ítem del carrito esté presente
    if (id_carrito_item === undefined || isNaN(id_carrito_item)) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID del ítem del carrito no proporcionado o no es válido.'
      });
    }

    // 2. Ejecutar la consulta DELETE
    //    Es crucial incluir FK_id_usuario en la cláusula WHERE para asegurar
    //    que un usuario solo pueda eliminar sus propios ítems del carrito.
    const [deleteResult] = await pool.execute(
      `DELETE FROM carrito_compras
       WHERE id_carrito = ? AND FK_id_usuario = ?`,
      [id_carrito_item, fk_id_usuario]
    );

    // 3. Verificar si se eliminó alguna fila
    if (deleteResult.affectedRows === 0) {
      // Esto puede ocurrir si el ítem no existe o no pertenece al usuario
      return res.status(404).json({
        success: false,
        mensaje: 'Ítem del carrito no encontrado o no pertenece a este usuario.'
      });
    }

    // 4. Devolver respuesta de éxito
    return res.status(200).json({
      success: true,
      mensaje: 'Ítem eliminado del carrito exitosamente.',
      id_carrito_item_eliminado: id_carrito_item
    });

  } catch (error) {
    console.error('Error al eliminar ítem del carrito:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor al procesar la solicitud de eliminación.'
    });
  }
}

module.exports = {
  EliminarItemCarrito
};