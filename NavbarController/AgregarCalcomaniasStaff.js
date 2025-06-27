const pool = require('../db');

async function AgregarCalcomaniasStaff(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Agregar Calcomanía al Carrito ===");
        console.log("req.user:", req.user); // Información del usuario desde el token

        const { id_calcomania, tamano, cantidad = 1 } = req.body; // Cantidad por defecto es 1
        const fk_id_usuario = req.user.id_usuario; // ID del usuario del token

        // 1. Validaciones de entrada
        if (!fk_id_usuario) {
            return res.status(401).json({
                success: false,
                mensaje: 'Autenticación requerida: ID de usuario no encontrado en el token.'
            });
        }
        if (!id_calcomania) {
            return res.status(400).json({
                success: false,
                mensaje: 'ID de la calcomanía es obligatorio.'
            });
        }
        if (!tamano || !['pequeño', 'mediano', 'grande'].includes(tamano.toLowerCase())) {
            return res.status(400).json({
                success: false,
                mensaje: 'Tamaño de la calcomanía no proporcionado o no es válido (debe ser "pequeño", "mediano" o "grande").'
            });
        }
        if (cantidad < 1) {
            return res.status(400).json({
                success: false,
                mensaje: 'La cantidad debe ser al menos 1.'
            });
        }

        // 2. Verificar si la calcomanía existe y está activa
        const [calcomaniaExistente] = await pool.execute(
            `SELECT id_calcomania, nombre, estado, stock_pequeno, stock_mediano, stock_grande FROM calcomania WHERE id_calcomania = ?`,
            [id_calcomania]
        );

        if (calcomaniaExistente.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'Calcomanía no encontrada.'
            });
        }

        const calcomania = calcomaniaExistente[0];

        if (!calcomania.estado) {
            return res.status(400).json({
                success: false,
                mensaje: 'La calcomanía no está activa y no puede ser agregada al carrito.'
            });
        }

        // 3. Verificar stock disponible para el tamaño específico
        let stockDisponible;
        switch (tamano.toLowerCase()) {
            case 'pequeño':
                stockDisponible = calcomania.stock_pequeno;
                break;
            case 'mediano':
                stockDisponible = calcomania.stock_mediano;
                break;
            case 'grande':
                stockDisponible = calcomania.stock_grande;
                break;
            default:
                stockDisponible = 0; // Esto no debería pasar debido a la validación previa
        }

        if (stockDisponible < cantidad) {
            return res.status(400).json({
                success: false,
                mensaje: `Stock insuficiente para la calcomanía en tamaño "${tamano}". Stock disponible: ${stockDisponible}`
            });
        }

        // 4. Verificar si la calcomanía con el mismo tamaño ya está en el carrito del usuario
        const [itemExistenteEnCarrito] = await pool.execute(
            `SELECT id_carrito, cantidad FROM carrito_compras WHERE FK_id_usuario = ? AND FK_id_calcomania = ? AND tamano = ?`,
            [fk_id_usuario, id_calcomania, tamano.toLowerCase()]
        );

        if (itemExistenteEnCarrito.length > 0) {
            // Si ya existe, actualizamos la cantidad
            const nuevaCantidad = itemExistenteEnCarrito[0].cantidad + cantidad;

            // Volver a verificar stock con la nueva cantidad
            if (stockDisponible < nuevaCantidad) {
                return res.status(400).json({
                    success: false,
                    mensaje: `No se pudo actualizar el carrito. Stock insuficiente para la nueva cantidad de la calcomanía en tamaño "${tamano}". Stock disponible: ${stockDisponible}`
                });
            }

            await pool.execute(
                `UPDATE carrito_compras SET cantidad = ?, fecha_adicion = CURRENT_TIMESTAMP WHERE id_carrito = ?`,
                [nuevaCantidad, itemExistenteEnCarrito[0].id_carrito]
            );

            return res.status(200).json({
                success: true,
                mensaje: `Cantidad de calcomanía "${calcomania.nombre}" (${tamano}) actualizada en el carrito.`,
                id_carrito_item: itemExistenteEnCarrito[0].id_carrito,
                nueva_cantidad: nuevaCantidad
            });
        } else {
            // Si no existe, la insertamos como un nuevo item
            const [result] = await pool.execute(
                `INSERT INTO carrito_compras (FK_id_usuario, FK_id_calcomania, cantidad, tamano) VALUES (?, ?, ?, ?)`,
                [fk_id_usuario, id_calcomania, cantidad, tamano.toLowerCase()]
            );

            return res.status(201).json({
                success: true,
                mensaje: `Calcomanía "${calcomania.nombre}" (${tamano}) agregada al carrito exitosamente.`,
                id_carrito_item: result.insertId,
                cantidad_agregada: cantidad
            });
        }

    } catch (error) {
        console.error('❌ Error al agregar calcomanía al carrito:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al agregar la calcomanía al carrito.'
        });
    }
}

module.exports = {
    AgregarCalcomaniasStaff
};