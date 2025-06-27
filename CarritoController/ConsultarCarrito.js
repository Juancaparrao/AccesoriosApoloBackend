const pool = require('../db');

async function ConsultarCarrito(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Carrito (Lógica de Calcomanías por Rol) ===");
        console.log("req.user:", req.user); // Información del usuario desde el token

        const fk_id_usuario = req.user.id_usuario; // ID del usuario del token

        // 1. Validar que el ID de usuario esté presente
        if (!fk_id_usuario) {
            return res.status(400).json({
                success: false,
                mensaje: 'ID de usuario no proporcionado en el token.'
            });
        }

        // Obtener los IDs de los roles 'gerente' y 'vendedor' para filtrar calcomanías de staff
        const [rolesStaffResult] = await pool.execute(
            `SELECT id_rol FROM rol WHERE nombre IN ('gerente', 'vendedor')`
        );
        const staffRoleIds = rolesStaffResult.map(rol => rol.id_rol);

        // Obtener el ID del rol 'cliente'
        const [rolClienteResult] = await pool.execute(
            `SELECT id_rol FROM rol WHERE nombre = 'cliente'`
        );
        const clienteRoleId = rolClienteResult.length > 0 ? rolClienteResult[0].id_rol : null;

        // 2. Consulta SQL para obtener ítems del carrito con LEFT JOINs
        // Ahora seleccionamos más información de calcomanía para la lógica condicional.
        const [rows] = await pool.execute(
            `SELECT
                cc.id_carrito,
                cc.cantidad,
                cc.fecha_adicion,
                cc.tamano AS carrito_tamano_calcomania, -- Tamaño guardado en carrito_compras para calcomanías de staff

                p.referencia AS producto_referencia,
                p.nombre AS producto_nombre,
                (
                    SELECT url_imagen
                    FROM producto_imagen pi
                    WHERE pi.FK_referencia_producto = p.referencia
                    ORDER BY pi.id_imagen ASC
                    LIMIT 1
                ) AS producto_url_imagen_principal,
                p.marca AS producto_marca,
                p.precio_unidad AS producto_precio_unidad,
                p.precio_descuento AS producto_precio_descuento,

                c.id_calcomania AS calcomania_id,
                c.nombre AS calcomania_nombre,
                c.url_archivo AS calcomania_url_archivo,
                c.tamano_x AS calcomania_tamano_x,       -- Para calcomanías de cliente
                c.tamano_y AS calcomania_tamano_y,       -- Para calcomanías de cliente
                c.precio_unidad AS calcomania_precio_unidad_base,
                c.precio_descuento AS calcomania_precio_descuento_base,
                u_cal.id_usuario AS calcomania_fk_id_usuario, -- ID del usuario que creó la calcomanía
                ur_cal.id_rol AS calcomania_id_rol_creador -- Rol del usuario que creó la calcomanía
            FROM
                carrito_compras cc
            LEFT JOIN
                producto p ON cc.FK_referencia_producto = p.referencia
            LEFT JOIN
                calcomania c ON cc.FK_id_calcomania = c.id_calcomania
            LEFT JOIN
                usuario u_cal ON c.fk_id_usuario = u_cal.id_usuario
            LEFT JOIN
                usuario_rol ur_cal ON u_cal.id_usuario = ur_cal.fk_id_usuario
            WHERE
                cc.FK_id_usuario = ?`,
            [fk_id_usuario]
        );

        // 3. Procesar los resultados de la consulta
        const carritoItems = rows.map(row => {
            if (row.producto_referencia) { // Es un producto
                let precioFinalProducto;
                let tieneDescuento = false;

                if (row.producto_precio_descuento !== null && row.producto_precio_descuento < row.producto_precio_unidad) {
                    precioFinalProducto = parseFloat(row.producto_precio_descuento);
                    tieneDescuento = true;
                } else {
                    precioFinalProducto = parseFloat(row.producto_precio_unidad);
                }

                return {
                    tipo: 'producto',
                    id_carrito_item: row.id_carrito,
                    referencia: row.producto_referencia,
                    nombre: row.producto_nombre,
                    url_imagen: row.producto_url_imagen_principal,
                    marca: row.producto_marca,
                    precio_actual: precioFinalProducto,
                    precio_unidad_original: tieneDescuento ? parseFloat(row.producto_precio_unidad) : undefined,
                    cantidad: row.cantidad
                };
            } else if (row.calcomania_id) { // Es una calcomanía
                const calcomaniaOutput = {
                    id_carrito_item: row.id_carrito,
                    id_calcomania: row.calcomania_id,
                    nombre: row.calcomania_nombre,
                    url_archivo: row.calcomania_url_archivo,
                    cantidad: row.cantidad
                };

                const precioBaseOriginal = parseFloat(row.calcomania_precio_unidad_base);
                const precioDescuentoOriginal = parseFloat(row.calcomania_precio_descuento_base);
                const rolCreador = row.calcomania_id_rol_creador;

                // Lógica condicional basada en el rol del creador de la calcomanía
                if (staffRoleIds.includes(rolCreador)) { // Calcomanía creada por gerente o vendedor
                    const tamano = row.carrito_tamano_calcomania; // Tamaño guardado en carrito_compras

                    let precioAjustadoBase;
                    let precioAjustadoDescuento;

                    // Determinar el precio base y de descuento ajustado por tamaño
                    if (tamano === 'pequeño') {
                        precioAjustadoBase = precioBaseOriginal;
                        precioAjustadoDescuento = precioDescuentoOriginal;
                    } else if (tamano === 'mediano') {
                        precioAjustadoBase = precioBaseOriginal * 2.25; // 125% adicional = 225% del original
                        precioAjustadoDescuento = precioDescuentoOriginal !== null ? precioDescuentoOriginal * 2.25 : null;
                    } else if (tamano === 'grande') {
                        precioAjustadoBase = precioBaseOriginal * 4.00; // 300% adicional = 400% del original
                        precioAjustadoDescuento = precioDescuentoOriginal !== null ? precioDescuentoOriginal * 4.00 : null;
                    } else {
                        // Fallback si el tamaño no es válido, aunque se valida al agregar
                        precioAjustadoBase = precioBaseOriginal;
                        precioAjustadoDescuento = precioDescuentoOriginal;
                    }

                    // Asignar el tipo y los precios calculados
                    calcomaniaOutput.tipo = 'calcomania_staff';
                    calcomaniaOutput.tamano = tamano;

                    if (precioAjustadoDescuento !== null && precioAjustadoDescuento < precioAjustadoBase) {
                        calcomaniaOutput.precio_actual = parseFloat(precioAjustadoDescuento.toFixed(2));
                        calcomaniaOutput.precio_unidad_original = parseFloat(precioAjustadoBase.toFixed(2));
                    } else {
                        calcomaniaOutput.precio_actual = parseFloat(precioAjustadoBase.toFixed(2));
                    }

                } else if (rolCreador === clienteRoleId) { // Calcomanía creada por un cliente
                    // Mantener el precio base sin ajustes por tamaño
                    calcomaniaOutput.tipo = 'calcomania_cliente';
                    calcomaniaOutput.tamano_x = row.calcomania_tamano_x; // Dimensiones originales
                    calcomaniaOutput.tamano_y = row.calcomania_tamano_y; // Dimensiones originales
                    calcomaniaOutput.precio_unidad = parseFloat(precioBaseOriginal.toFixed(2)); // Solo precio_unidad
                    // No se muestran precio_descuento ni precio_actual, solo precio_unidad
                } else {
                    // Si el rol es desconocido o no encaja en las categorías, por defecto como calcomanía de cliente
                    calcomaniaOutput.tipo = 'calcomania_desconocida';
                    calcomaniaOutput.tamano_x = row.calcomania_tamano_x;
                    calcomaniaOutput.tamano_y = row.calcomania_tamano_y;
                    calcomaniaOutput.precio_unidad = parseFloat(precioBaseOriginal.toFixed(2));
                }

                return calcomaniaOutput;
            }
            return null;
        }).filter(item => item !== null);

        // 4. Devolver la respuesta con los ítems del carrito
        return res.status(200).json({
            success: true,
            mensaje: 'Carrito de compras consultado exitosamente.',
            carrito: carritoItems
        });

    } catch (error) {
        console.error('Error al consultar el carrito de compras:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al consultar el carrito.'
        });
    }
}

module.exports = {
    ConsultarCarrito
};