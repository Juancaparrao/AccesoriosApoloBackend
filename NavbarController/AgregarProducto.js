const pool = require('../db');

async function AgregarProductoAlCarrito(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Agregar Producto al Carrito ===");
        console.log("req.user:", req.user); // Información del usuario desde el token

        const { referencia_producto, cantidad = 1 } = req.body; // Referencia del producto y cantidad (por defecto 1)
        const fk_id_usuario = req.user.id_usuario; // ID del usuario desde el token

        // 1. Validaciones de entrada
        if (!fk_id_usuario) {
            return res.status(401).json({
                success: false,
                mensaje: 'Autenticación requerida: ID de usuario no encontrado en el token.'
            });
        }
        if (!referencia_producto || typeof referencia_producto !== 'string' || referencia_producto.trim() === '') {
            return res.status(400).json({
                success: false,
                mensaje: 'La referencia del producto es obligatoria y debe ser un string válido.'
            });
        }
        if (cantidad < 1) {
            return res.status(400).json({
                success: false,
                mensaje: 'La cantidad debe ser al menos 1.'
            });
        }

        // 2. Verificar si el producto existe y está activo, y obtener su stock
        const [productoExistente] = await pool.execute(
            `SELECT referencia, nombre, stock, estado FROM producto WHERE referencia = ?`,
            [referencia_producto]
        );

        if (productoExistente.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Producto no encontrado.'
            });
        }

        const producto = productoExistente[0];

        if (!producto.estado) { // `estado` es BOOLEAN (TRUE/FALSE o 1/0)
            return res.status(400).json({
                success: false,
                mensaje: 'El producto no está activo y no puede ser agregado al carrito.'
            });
        }

        if (producto.stock < cantidad) {
            return res.status(400).json({
                success: false,
                mensaje: `Stock insuficiente para el producto "${producto.nombre}". Stock disponible: ${producto.stock}`
            });
        }

        // 3. Verificar si el producto ya está en el carrito del usuario
        const [itemExistenteEnCarrito] = await pool.execute(
            `SELECT id_carrito, cantidad FROM carrito_compras WHERE FK_id_usuario = ? AND FK_referencia_producto = ?`,
            [fk_id_usuario, referencia_producto]
        );

        if (itemExistenteEnCarrito.length > 0) {
            // Si ya existe, actualizamos la cantidad
            const nuevaCantidad = itemExistenteEnCarrito[0].cantidad + cantidad;

            // Volver a verificar stock con la nueva cantidad total
            if (producto.stock < nuevaCantidad) {
                return res.status(400).json({
                    success: false,
                    mensaje: `No se pudo actualizar el carrito. Stock insuficiente para la nueva cantidad de "${producto.nombre}". Stock disponible: ${producto.stock}`
                });
            }

            await pool.execute(
                `UPDATE carrito_compras SET cantidad = ?, fecha_adicion = CURRENT_TIMESTAMP WHERE id_carrito = ?`,
                [nuevaCantidad, itemExistenteEnCarrito[0].id_carrito]
            );

            return res.status(200).json({
                success: true,
                mensaje: `Cantidad de producto "${producto.nombre}" actualizada en el carrito.`,
                id_carrito_item: itemExistenteEnCarrito[0].id_carrito,
                nueva_cantidad: nuevaCantidad
            });
        } else {
            // Si no existe, la insertamos como un nuevo item
            const [result] = await pool.execute(
                `INSERT INTO carrito_compras (FK_id_usuario, FK_referencia_producto, cantidad) VALUES (?, ?, ?)`,
                [fk_id_usuario, referencia_producto, cantidad]
            );

            return res.status(201).json({
                success: true,
                mensaje: `Producto "${producto.nombre}" agregado al carrito exitosamente.`,
                id_carrito_item: result.insertId,
                cantidad_agregada: cantidad
            });
        }

    } catch (error) {
        console.error('❌ Error al agregar producto al carrito:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al agregar el producto al carrito.'
        });
    }
}

module.exports = {
    AgregarProductoAlCarrito
};