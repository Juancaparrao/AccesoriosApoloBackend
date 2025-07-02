const pool = require('../db');

async function ConsultarCarritoYResumen(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Carrito y Resumen ===");

        let fk_id_usuario;
        if (req.user && req.user.id_usuario) {
            fk_id_usuario = req.user.id_usuario;
            console.log("Usuario AUTENTICADO consultando carrito. ID:", fk_id_usuario);
        } else {
            return res.status(401).json({
                success: false,
                mensaje: 'Acceso no autorizado. Para consultar el carrito, el usuario debe estar autenticado.'
            });
        }

        const [carritoItems] = await pool.execute(
            `SELECT
                cc.FK_referencia_producto AS referencia_producto,
                cc.FK_id_calcomania AS id_calcomania,
                cc.cantidad,
                cc.tamano,
                p.nombre AS nombre_producto,
                p.precio_unidad AS precio_unidad_producto,
                p.precio_descuento AS precio_descuento_producto,
                (SELECT url_imagen FROM producto_imagen pi WHERE pi.FK_referencia_producto = p.referencia ORDER BY pi.id_imagen ASC LIMIT 1) AS url_imagen_producto,
                c.nombre AS nombre_calcomania,
                c.url_archivo AS url_archivo_calcomania,
                c.precio_unidad AS precio_base_calcomania,
                c.precio_descuento AS precio_descuento_calcomania_base
            FROM
                carrito_compras cc
            LEFT JOIN
                producto p ON cc.FK_referencia_producto = p.referencia
            LEFT JOIN
                calcomania c ON cc.FK_id_calcomania = c.id_calcomania
            WHERE
                cc.FK_id_usuario = ?`,
            [fk_id_usuario]
        );

        let articulosEnCarrito = [];
        let totalArticulosSinDescuento = 0;
        let descuentoTotalArticulos = 0;
        let totalArticulosFinal = 0;

        carritoItems.forEach(item => {
            let nombre, url_imagen_o_archivo, precio_unidad_calculado, precio_descuento_calculado, subtotalArticulo, porcentaje_descuento = 0;
            let esProducto = item.referencia_producto !== null;

            if (esProducto) {
                // --- Lógica para PRODUCTOS (sin cambios) ---
                nombre = item.nombre_producto;
                url_imagen_o_archivo = item.url_imagen_producto;
                precio_unidad_calculado = parseFloat(item.precio_unidad_producto);
                precio_descuento_calculado = item.precio_descuento_producto ? parseFloat(item.precio_descuento_producto) : null;
            
            } else { // --- Lógica REFACTORIZADA para CALCOMANÍAS ---
                nombre = item.nombre_calcomania;
                url_imagen_o_archivo = item.url_archivo_calcomania;
                
                const precio_base = parseFloat(item.precio_base_calcomania);
                const precio_descuento_base = item.precio_descuento_calcomania_base ? parseFloat(item.precio_descuento_calcomania_base) : null;

                // 1. Calcular el porcentaje de descuento basado en los precios base (tamaño pequeño)
                if (precio_descuento_base !== null && precio_descuento_base < precio_base && precio_base > 0) {
                    porcentaje_descuento = ((precio_base - precio_descuento_base) / precio_base);
                }

                // 2. Determinar el multiplicador de precio según el tamaño
                let multiplicador_tamano = 1.0;
                switch (item.tamano.toLowerCase()) {
                    case 'pequeño':
                        multiplicador_tamano = 1.0;
                        break;
                    case 'mediano':
                        multiplicador_tamano = 2.25;
                        break;
                    case 'grande':
                        multiplicador_tamano = 4.00;
                        break;
                    default:
                        console.warn(`Tamaño de calcomanía desconocido: ${item.tamano}. Usando multiplicador base 1.0.`);
                        multiplicador_tamano = 1.0;
                        break;
                }

                // 3. Calcular el precio original para el tamaño seleccionado
                precio_unidad_calculado = precio_base * multiplicador_tamano;

                // 4. Calcular el precio con descuento para el tamaño seleccionado, usando el porcentaje
                precio_descuento_calculado = null;
                if (porcentaje_descuento > 0) {
                    precio_descuento_calculado = precio_unidad_calculado * (1 - porcentaje_descuento);
                }
            }

            // --- Lógica de cálculo de totales (común para productos y calcomanías) ---
            const cantidad = item.cantidad;

            totalArticulosSinDescuento += precio_unidad_calculado * cantidad;

            if (precio_descuento_calculado !== null && precio_descuento_calculado < precio_unidad_calculado) {
                subtotalArticulo = precio_descuento_calculado * cantidad;
                descuentoTotalArticulos += (precio_unidad_calculado - precio_descuento_calculado) * cantidad;
            } else {
                subtotalArticulo = precio_unidad_calculado * cantidad;
            }
            totalArticulosFinal += subtotalArticulo;

            // --- Añadir el artículo procesado al array para la respuesta ---
            articulosEnCarrito.push({
                referencia_producto: item.referencia_producto,
                id_calcomania: item.id_calcomania,
                nombre: nombre,
                url_imagen_o_archivo: url_imagen_o_archivo,
                cantidad: cantidad,
                tamano: item.tamano,
                precio_unidad_original: parseFloat(precio_unidad_calculado.toFixed(2)),
                precio_con_descuento: precio_descuento_calculado ? parseFloat(precio_descuento_calculado.toFixed(2)) : null,
                // Añadimos el porcentaje de descuento para las calcomanías
                porcentaje_descuento: !esProducto ? Math.round(porcentaje_descuento * 100) : null,
                subtotalArticulo: parseFloat(subtotalArticulo.toFixed(2))
            });
        });

        const PRECIO_ENVIO = 14900; // Asumiendo pesos colombianos COP
        const subtotalPedido = parseFloat((totalArticulosFinal).toFixed(2));
        const totalPedido = parseFloat((subtotalPedido + PRECIO_ENVIO).toFixed(2));
        
        // --- INICIO: Lógica para ACTUALIZAR EL CAMPO valor_total en la tabla FACTURA (sin cambios) ---
        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            const [existingFactura] = await connection.execute(
                `SELECT id_factura FROM factura WHERE fk_id_usuario = ? ORDER BY fecha_venta DESC LIMIT 1`,
                [fk_id_usuario]
            );

            if (existingFactura.length > 0) {
                const id_factura_a_actualizar = existingFactura[0].id_factura;

                await connection.execute(
                    `UPDATE factura SET valor_total = ? WHERE id_factura = ?`,
                    [totalPedido, id_factura_a_actualizar]
                );
                console.log(`Factura ${id_factura_a_actualizar} actualizada con valor_total: ${totalPedido}`);
            } else {
                console.warn(`No se encontró una factura existente para el usuario ${fk_id_usuario} para actualizar el valor_total.`);
            }

            await connection.commit();
        } catch (updateError) {
            if (connection) await connection.rollback();
            console.error('Error al actualizar valor_total en la factura:', updateError);
        } finally {
            if (connection) connection.release();
        }
        // --- FIN: Lógica para ACTUALIZAR EL CAMPO valor_total en la tabla FACTURA ---

        const resumenPedido = {
            TotalArticulosSinDescuento: parseFloat(totalArticulosSinDescuento.toFixed(2)),
            DescuentoArticulos: parseFloat(descuentoTotalArticulos.toFixed(2)),
            Subtotal: subtotalPedido,
            PrecioEnvio: PRECIO_ENVIO,
            Total: totalPedido
        };

        res.status(200).json({
            success: true,
            mensaje: 'Carrito de compras y resumen obtenidos exitosamente.',
            numero_articulos_carrito: carritoItems.length,
            articulos_en_carrito: articulosEnCarrito,
            resumen_pedido: resumenPedido
        });

    } catch (error) {
        console.error('Error al consultar el carrito y resumen:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al consultar el carrito.'
        });
    }
}

module.exports = {
    ConsultarCarritoYResumen,
};