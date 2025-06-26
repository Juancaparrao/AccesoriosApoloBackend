const pool = require('../db');

async function ActualizarCarrito(req, res) {
  try {
    console.log("=== DEBUG BACKEND - Actualizar Cantidad en Carrito ===");
    console.log("req.body:", req.body);
    console.log("req.user:", req.user); // Información del usuario desde el token (id_usuario, roles)

    const { id_carrito_item, nueva_cantidad } = req.body;
    const fk_id_usuario = req.user.id_usuario;
    const userRoles = req.user.roles || []; // Asumiendo que el token decodificado incluye los roles del usuario

    // 1. Validar datos requeridos
    if (id_carrito_item === undefined || nueva_cantidad === undefined || isNaN(nueva_cantidad) || nueva_cantidad < 0) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan datos requeridos o la nueva cantidad no es válida.'
      });
    }

    // 2. Obtener información actual del ítem del carrito y del ítem asociado (producto/calcomanía)
    const [cartItemRows] = await pool.execute(
      `SELECT
        cc.FK_referencia_producto,
        cc.FK_id_calcomania,
        cc.cantidad AS cantidad_actual_carrito,
        p.stock AS producto_stock_general,
        c.estado AS calcomania_estado, -- Podrías necesitar el estado para calcomanías
        c.stock_pequeno, -- Si quieres validar por tamaño de calcomanía, necesitarás saber cuál se está comprando
        c.stock_mediano,
        c.stock_grande
      FROM
        carrito_compras cc
      LEFT JOIN
        producto p ON cc.FK_referencia_producto = p.referencia
      LEFT JOIN
        calcomania c ON cc.FK_id_calcomania = c.id_calcomania
      WHERE
        cc.id_carrito = ? AND cc.FK_id_usuario = ?`,
      [id_carrito_item, fk_id_usuario]
    );

    if (cartItemRows.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Ítem del carrito no encontrado o no pertenece a este usuario.'
      });
    }

    const cartItem = cartItemRows[0];
    const { FK_referencia_producto, FK_id_calcomania, cantidad_actual_carrito } = cartItem;

    let mensajeRespuesta = 'Cantidad del ítem en el carrito actualizada.';

    // 3. Lógica para eliminar el ítem si la nueva cantidad es 0
    if (nueva_cantidad === 0) {
      await pool.execute(
        `DELETE FROM carrito_compras WHERE id_carrito = ? AND FK_id_usuario = ?`,
        [id_carrito_item, fk_id_usuario]
      );
      return res.status(200).json({
        success: true,
        mensaje: 'Ítem eliminado del carrito exitosamente (cantidad llegó a 0).',
        id_carrito_item: id_carrito_item,
        cantidad_final: 0
      });
    }

    // 4. Validaciones de stock y límite (si la cantidad es > 0)
    const LIMITE_CANTIDAD = 50;

    // A. Es un Producto
    if (FK_referencia_producto) {
      const productoStock = cartItem.producto_stock_general;

      // Buscar si el producto fue creado por un gerente/vendedor
      // Esto requeriría una JOIN adicional o tener esta info en la tabla PRODUCTO
      // Por ahora, asumimos que si es un producto, aplica la regla de stock.
      // Si necesitas distinguir si fue creado por gerente/vendedor, deberías añadir una FK a USUARIO
      // en la tabla PRODUCTO que indique quién lo creó y luego consultar el rol de ese usuario.
      // Para esta implementación, cualquier producto existente aplicará la regla de stock.

      if (productoStock === null || productoStock === undefined) {
          // Esto podría ocurrir si el producto fue eliminado de la tabla PRODUCTO
          // pero sigue en el carrito. Podrías eliminarlo del carrito aquí también.
          return res.status(400).json({ success: false, mensaje: 'Producto asociado al carrito no encontrado.' });
      }

      if (nueva_cantidad > LIMITE_CANTIDAD) {
        return res.status(400).json({
          success: false,
          mensaje: `La cantidad para productos no puede exceder el límite de ${LIMITE_CANTIDAD}.`
        });
      }

      if (nueva_cantidad > productoStock) {
        return res.status(400).json({
          success: false,
          mensaje: `No hay suficiente stock para el producto. Stock disponible: ${productoStock}.`
        });
      }
    }
    // B. Es una Calcomanía
    else if (FK_id_calcomania) {
      // Necesitamos saber quién creó la calcomanía para aplicar la regla de stock.
      // Esto implica un JOIN a CALCOMANIA y luego a USUARIO y USUARIO_ROL.

      const [calcomaniaCreatorRows] = await pool.execute(
        `SELECT
          ur.id_rol,
          r.nombre AS rol_nombre
        FROM
          calcomania c
        JOIN
          usuario_rol ur ON c.fk_id_usuario = ur.fk_id_usuario
        JOIN
          rol r ON ur.id_rol = r.id_rol
        WHERE
          c.id_calcomania = ?`,
        [FK_id_calcomania]
      );

      const creatorRoles = calcomaniaCreatorRows.map(row => row.rol_nombre);
      const isCreatedByClient = creatorRoles.includes('cliente');
      const isCreatedByStaff = creatorRoles.includes('gerente') || creatorRoles.includes('vendedor');


      if (isCreatedByClient) {
        // Calcomanía creada por un cliente: No se mira stock, solo el límite.
        if (nueva_cantidad > LIMITE_CANTIDAD) {
          return res.status(400).json({
            success: false,
            mensaje: `La cantidad para calcomanías de cliente no puede exceder el límite de ${LIMITE_CANTIDAD}.`
          });
        }
      } else if (isCreatedByStaff) {
        // Calcomanía creada por gerente/vendedor: Validar stock (asumiendo stock_general o una lógica de stock_talla)
        // OJO: Tu tabla CALCOMANIA tiene stock_pequeno, stock_mediano, stock_grande.
        // Si quieres validar por un tamaño específico, necesitarías saber qué tamaño
        // de calcomanía está comprando el usuario (no está en carrito_compras).
        // Por ahora, asumiré que necesitas una lógica para un "stock_general" de calcomanía
        // o usar uno de los stocks específicos si el tamaño es relevante y ya se seleccionó.
        // Si no se selecciona un tamaño al agregar, podrías sumar los stocks disponibles
        // o requerir que el carrito almacene el tamaño específico para validar aquí.

        // Por simplicidad para esta función, sumaremos todos los stocks disponibles
        // para dar una idea del stock total de esa calcomanía.
        const calcomaniaStockTotal = (cartItem.stock_pequeno || 0) + (cartItem.stock_mediano || 0) + (cartItem.stock_grande || 0);

        if (nueva_cantidad > LIMITE_CANTIDAD) {
            return res.status(400).json({
                success: false,
                mensaje: `La cantidad para calcomanías de staff no puede exceder el límite de ${LIMITE_CANTIDAD}.`
            });
        }
        if (nueva_cantidad > calcomaniaStockTotal) {
            return res.status(400).json({
                success: false,
                mensaje: `No hay suficiente stock para esta calcomanía. Stock total disponible: ${calcomaniaStockTotal}.`
            });
        }
      } else {
          // Si la calcomanía no está asociada a ningún rol de cliente/staff conocido
          return res.status(400).json({
              success: false,
              mensaje: 'No se pudo determinar el tipo de calcomanía para la validación de stock.'
          });
      }
    } else {
        // Este caso no debería ocurrir si los FKs del carrito son correctos (siempre producto o calcomanía)
        return res.status(400).json({
            success: false,
            mensaje: 'El ítem del carrito no es un producto ni una calcomanía válida.'
        });
    }

    // 5. Actualizar la cantidad en el carrito
    await pool.execute(
      `UPDATE carrito_compras
       SET cantidad = ?
       WHERE id_carrito = ? AND FK_id_usuario = ?`,
      [nueva_cantidad, id_carrito_item, fk_id_usuario]
    );

    return res.status(200).json({
      success: true,
      mensaje: mensajeRespuesta,
      id_carrito_item: id_carrito_item,
      cantidad_final: nueva_cantidad
    });

  } catch (error) {
    console.error('Error al actualizar la cantidad del carrito:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor al procesar la solicitud de actualización del carrito.'
    });
  }
}

module.exports = {
  ActualizarCarrito
};