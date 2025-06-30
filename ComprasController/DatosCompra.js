const pool = require('../db');
const { enviarCorreoBienvenida } = require('../services/emailService'); // Importa tu servicio de correo

async function ConsultarCarritoYResumen(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Carrito y Resumen ===");

        let fk_id_usuario;
        if (req.user && req.user.id_usuario) {
            fk_id_usuario = req.user.id_usuario;
            console.log("Usuario AUTENTICADO consultando carrito. ID:", fk_id_usuario);
        } else {
            // Lógica para carritos de invitado (si la implementas):
            // Necesitarías una forma de identificar el carrito de un invitado,
            // por ejemplo, usando req.session.guestId o un token del frontend.
            // Por ahora, si no hay usuario autenticado, devuelve un error 401.
            return res.status(401).json({
                success: false,
                mensaje: 'Acceso no autorizado. Para consultar el carrito, el usuario debe estar autenticado.'
            });
        }

        // 1. Obtener los artículos del carrito (productos y calcomanías)
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
            let nombre, url_imagen_o_archivo, precio_unidad_calculado, precio_descuento_calculado, subtotalArticulo;
            let esProducto = item.referencia_producto !== null;

            if (esProducto) {
                nombre = item.nombre_producto;
                url_imagen_o_archivo = item.url_imagen_producto;
                precio_unidad_calculado = parseFloat(item.precio_unidad_producto);
                precio_descuento_calculado = item.precio_descuento_producto ? parseFloat(item.precio_descuento_producto) : null;
            } else { // Es una calcomanía
                nombre = item.nombre_calcomania;
                url_imagen_o_archivo = item.url_archivo_calcomania;
                let precio_base_calcomania = parseFloat(item.precio_base_calcomania);
                let precio_descuento_base_calcomania = item.precio_descuento_calcomania_base ? parseFloat(item.precio_descuento_calcomania_base) : null;

                switch (item.tamano.toLowerCase()) {
                    case 'pequeño':
                        precio_unidad_calculado = precio_base_calcomania;
                        precio_descuento_calculado = precio_descuento_base_calcomania;
                        break;
                    case 'mediano':
                        precio_unidad_calculado = precio_base_calcomania * 2.25;
                        precio_descuento_calculado = precio_descuento_base_calcomania ? precio_descuento_base_calcomania * 2.25 : null;
                        break;
                    case 'grande':
                        precio_unidad_calculado = precio_base_calcomania * 4.00;
                        precio_descuento_calculado = precio_descuento_base_calcomania ? precio_descuento_base_calcomania * 4.00 : null;
                        break;
                    default:
                        console.warn(`Tamaño de calcomanía desconocido: ${item.tamano}. Usando precio base.`);
                        precio_unidad_calculado = precio_base_calcomania;
                        precio_descuento_calculado = precio_descuento_base_calcomania;
                        break;
                }
            }

            const cantidad = item.cantidad;

            totalArticulosSinDescuento += precio_unidad_calculado * cantidad;

            if (precio_descuento_calculado !== null && precio_descuento_calculado < precio_unidad_calculado) {
                subtotalArticulo = precio_descuento_calculado * cantidad;
                descuentoTotalArticulos += (precio_unidad_calculado - precio_descuento_calculado) * cantidad;
            } else {
                subtotalArticulo = precio_unidad_calculado * cantidad;
            }
            totalArticulosFinal += subtotalArticulo;


            articulosEnCarrito.push({
                referencia_producto: item.referencia_producto,
                id_calcomania: item.id_calcomania,
                nombre: nombre,
                url_imagen_o_archivo: url_imagen_o_archivo,
                cantidad: cantidad,
                tamano: item.tamano,
                precio_unidad_original: parseFloat(precio_unidad_calculado.toFixed(2)),
                precio_con_descuento: precio_descuento_calculado ? parseFloat(precio_descuento_calculado.toFixed(2)) : null,
                subtotalArticulo: parseFloat(subtotalArticulo.toFixed(2))
            });
        });

        const PRECIO_ENVIO = 14900; // Asumiendo pesos colombianos COP
        const subtotalPedido = parseFloat((totalArticulosFinal).toFixed(2));
        const totalPedido = parseFloat((subtotalPedido + PRECIO_ENVIO).toFixed(2));

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


async function FinalizarCompraYRegistro(req, res) {
    let connection;
    try {
        console.log("=== DEBUG BACKEND - Finalizar Compra y Registro (Completa) ===");

        // --- OBTENER DATOS NECESARIOS DE LA SESIÓN ---
        const checkoutInfoFromSession = req.session.checkout;

        if (!checkoutInfoFromSession || !checkoutInfoFromSession.fk_id_usuario_para_compra || !checkoutInfoFromSession.id_factura_temp) {
             console.error("DEBUG ERROR: Información de checkout incompleta en la sesión para finalizar la compra.");
             return res.status(400).json({
                 success: false,
                 mensaje: 'Información de la compra no encontrada en la sesión. Por favor, reinicie el proceso de compra.'
             });
         }

        // Recuperar los datos guardados en la sesión por DireccionEnvio
        const fk_id_usuario = checkoutInfoFromSession.fk_id_usuario_para_compra;
        const id_factura_temp = checkoutInfoFromSession.id_factura_temp;
        const esNuevoRegistro = checkoutInfoFromSession.es_nuevo_registro;
        // Aquí recuperamos la contraseña GENERADA Y GUARDADA en DireccionEnvio, no la desencriptamos porque no fue encriptada antes de guardarse en sesión.
        const contrasenaGenerada = checkoutInfoFromSession.contrasena_generada; // Será null si no fue nuevo registro

        // Recuperar los datos de dirección de envío asociados a la factura temporal
        // Estos ya están en la factura, pero necesitamos el correo para el email de bienvenida.
        const [facturaTemporalData] = await pool.execute(
            `SELECT direccion, informacion_adicional FROM factura WHERE id_factura = ? AND fk_id_usuario = ?`,
            [id_factura_temp, fk_id_usuario]
        );

        if (facturaTemporalData.length === 0) {
            console.error(`DEBUG ERROR: Factura temporal ID ${id_factura_temp} no encontrada para el usuario ${fk_id_usuario}.`);
            return res.status(404).json({
                success: false,
                mensaje: 'La factura temporal no pudo ser encontrada. Por favor, intente de nuevo.'
            });
        }
        const { direccion, informacion_adicional } = facturaTemporalData[0];

        // Obtener el correo del usuario que se registró/identificó
        // Ya que la lógica de usuario se manejó en DireccionEnvio, el fk_id_usuario ya apunta
        // al usuario correcto, ya sea existente o recién creado.
        const [userData] = await pool.execute(`SELECT correo FROM usuario WHERE id_usuario = ?`, [fk_id_usuario]);
        let usuarioEmail = userData.length > 0 ? userData[0].correo : null;

        if (!usuarioEmail) {
            console.error("DEBUG ERROR: No se pudo obtener el correo del usuario para finalizar la compra.");
            throw new Error("No se pudo obtener el correo del usuario.");
        }


        connection = await pool.getConnection();
        await connection.beginTransaction(); // Iniciar transacción

        // Los pasos de creación/actualización de usuario ya se manejaron en DireccionEnvio.
        // Aquí solo confirmamos el fk_id_usuario que viene de la sesión.
        console.log(`Procediendo con la compra para usuario ID: ${fk_id_usuario}. Nuevo registro: ${esNuevoRegistro}`);


        // 2. Mover el carrito del usuario a la factura
        // Obtener los artículos del carrito del usuario
        const [carritoItems] = await connection.execute(
            `SELECT
                cc.FK_referencia_producto AS referencia_producto,
                cc.FK_id_calcomania AS id_calcomania,
                cc.cantidad,
                cc.tamano,
                p.nombre AS nombre_producto,
                p.precio_unidad AS precio_unidad_producto,
                p.precio_descuento AS precio_descuento_producto,
                c.nombre AS nombre_calcomania,
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

        if (carritoItems.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                mensaje: 'El carrito de compras está vacío. No se puede finalizar una compra sin artículos.'
            });
        }

        let totalArticulosFinal = 0;
        let descuentoTotalArticulos = 0;

        for (const item of carritoItems) {
            let precio_unidad_calculado, precio_descuento_calculado;

            if (item.referencia_producto !== null) { // Es un producto
                precio_unidad_calculado = parseFloat(item.precio_unidad_producto);
                precio_descuento_calculado = item.precio_descuento_producto ? parseFloat(item.precio_descuento_producto) : null;
            } else { // Es una calcomanía
                let precio_base_calcomania = parseFloat(item.precio_base_calcomania);
                let precio_descuento_base_calcomania = item.precio_descuento_calcomania_base ? parseFloat(item.precio_descuento_calcomania_base) : null;

                switch (item.tamano.toLowerCase()) {
                    case 'pequeño':
                        precio_unidad_calculado = precio_base_calcomania;
                        precio_descuento_calculado = precio_descuento_base_calcomania;
                        break;
                    case 'mediano':
                        precio_unidad_calculado = precio_base_calcomania * 2.25;
                        precio_descuento_calculado = precio_descuento_base_calcomania ? precio_descuento_base_calcomania * 2.25 : null;
                        break;
                    case 'grande':
                        precio_unidad_calculado = precio_base_calcomania * 4.00;
                        precio_descuento_calculado = precio_descuento_base_calcomania ? precio_descuento_base_calcomania * 4.00 : null;
                        break;
                    default:
                        precio_unidad_calculado = precio_base_calcomania;
                        precio_descuento_calculado = precio_descuento_base_calcomania;
                        break;
                }
            }

            const cantidad = item.cantidad;
            descuentoTotalArticulos += (precio_descuento_calculado !== null && precio_descuento_calculado < precio_unidad_calculado) ?
                (precio_unidad_calculado - precio_descuento_calculado) * cantidad : 0;

            totalArticulosFinal += (precio_descuento_calculado !== null && precio_descuento_calculado < precio_unidad_calculado) ?
                precio_descuento_calculado * cantidad : precio_unidad_calculado * cantidad;

            // Insertar los detalles de la factura
            await connection.execute(
                `INSERT INTO detalle_factura (FK_id_factura, FK_referencia_producto, FK_id_calcomania, cantidad, precio_unitario, precio_descuento, tamano_calcomania) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    id_factura_temp, // Usar el id_factura_temp que ya creamos en DireccionEnvio
                    item.referencia_producto,
                    item.id_calcomania,
                    item.cantidad,
                    parseFloat(precio_unidad_calculado.toFixed(2)), // Precio original del ítem
                    precio_descuento_calculado ? parseFloat(precio_descuento_calculado.toFixed(2)) : null, // Precio con descuento del ítem (si aplica)
                    item.id_calcomania ? item.tamano : null // Solo para calcomanías
                ]
            );

            // Reducir el stock (aquí debes implementar la lógica para tus tablas de producto/calcomania)
            if (item.referencia_producto) {
                const [updateProductStock] = await connection.execute(
                    `UPDATE producto SET stock = stock - ? WHERE referencia = ?`,
                    [item.cantidad, item.referencia_producto]
                );
                // Si necesitas verificar el stock antes o manejar un error si es insuficiente:
                // SELECT stock FROM producto WHERE referencia = ?
                // if (currentStock < item.cantidad) { throw new Error('Stock insuficiente'); }
            } else if (item.id_calcomania) {
                // Si las calcomanías tienen stock:
                // const [updateCalcomaniaStock] = await connection.execute(
                //     `UPDATE calcomania SET stock = stock - ? WHERE id_calcomania = ?`,
                //     [item.cantidad, item.id_calcomania]
                // );
            }
        }
        console.log(`Detalles de factura y reducción de stock procesados para factura ID: ${id_factura_temp}`);

        const PRECIO_ENVIO = 14900;
        const subtotalFactura = parseFloat(totalArticulosFinal.toFixed(2));
        const totalFactura = parseFloat((subtotalFactura + PRECIO_ENVIO).toFixed(2));
        const descuentoAplicado = parseFloat(descuentoTotalArticulos.toFixed(2));

        // Actualizar la factura principal con los totales finales y el estado
        await connection.execute(
            `UPDATE factura SET total = ?, subtotal = ?, descuento = ?, precio_envio = ?, estado_pedido = 'Completada', fecha_venta = NOW() WHERE id_factura = ?`,
            [totalFactura, subtotalFactura, descuentoAplicado, PRECIO_ENVIO, id_factura_temp]
        );
        console.log(`Factura ID: ${id_factura_temp} actualizada con totales y estado 'Completada'.`);


        // 3. Limpiar el carrito de compras del usuario
        await connection.execute(
            `DELETE FROM carrito_compras WHERE FK_id_usuario = ?`,
            [fk_id_usuario]
        );
        console.log(`Carrito de compras limpiado para el usuario ID: ${fk_id_usuario}`);

        // 4. Limpiar la información de checkout de la sesión
        delete req.session.checkout;
        req.session.save((err) => {
            if (err) {
                console.error("DEBUG ERROR: Error al guardar la sesión después de FinalizarCompra:", err);
            } else {
                console.log("DEBUG: Sesión guardada y información de checkout eliminada.");
            }
        });

        await connection.commit();

        // 5. Enviar correo de bienvenida si es un nuevo registro
        // La `contrasenaGenerada` se recupera directamente de la sesión
        if (esNuevoRegistro && usuarioEmail && contrasenaGenerada) {
            const correoEnviado = await enviarCorreoBienvenida(usuarioEmail, contrasenaGenerada);
            if (correoEnviado) {
                console.log(`Correo de bienvenida enviado exitosamente a ${usuarioEmail}`);
            } else {
                console.warn(`Falló el envío del correo de bienvenida a ${usuarioEmail}.`);
            }
        }

        res.status(200).json({
            success: true,
            mensaje: '¡Compra finalizada exitosamente! Tu pedido está en camino.',
            id_factura: id_factura_temp,
            nuevo_usuario_registrado: esNuevoRegistro,
            contrasena_generada: esNuevoRegistro ? contrasenaGenerada : undefined, // Solo si es nuevo registro
            total_factura: totalFactura
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            console.error("Transacción revertida debido a un error.");
        }
        console.error('Error al procesar la finalización de la compra:', error);

        // Ya que la creación/actualización de usuario se maneja en DireccionEnvio,
        // este ER_DUP_ENTRY por 'correo' es menos probable que ocurra aquí,
        // a menos que algo más intente insertar un usuario con un correo duplicado.
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('correo')) {
            return res.status(409).json({
                success: false,
                mensaje: 'Un usuario con este correo electrónico ya existe. Si ya tiene una cuenta, inicie sesión.'
            });
        }
        // Manejar el caso de stock insuficiente (ajusta el mensaje de error o código SQL específico si es necesario)
        if (error.sqlMessage && error.sqlMessage.includes('stock')) { // Ejemplo, ajusta según el error real de tu DB
            return res.status(400).json({
                success: false,
                mensaje: 'No hay suficiente stock para uno o más artículos en su carrito. Por favor, revise las cantidades.'
            });
        }
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al procesar su solicitud.'
        });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    ConsultarCarritoYResumen,
    FinalizarCompraYRegistro
};