const pool = require('../db');
const bcrypt = require('bcrypt');
const { enviarCorreoBienvenida } = require('../templates/UsuarioNoRegistrado');

/**
 * Función auxiliar para generar contraseñas seguras.
 * Genera una contraseña que cumple con los requisitos:
 * - Mínimo 8 caracteres
 * - Al menos una mayúscula
 * - Al menos un símbolo especial
 * - Al menos un número
 */
function generarContrasenaSegura() {
    const chars = {
        lower: "abcdefghijklmnopqrstuvwxyz",
        upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        numbers: "0123456789",
        symbols: "!@#$%^&*()_+~`|}{[]:;?><,./-="
    };

    let password = [];
    // Asegurar al menos una de cada tipo para cumplir los requisitos
    password.push(chars.upper[Math.floor(Math.random() * chars.upper.length)]);
    password.push(chars.symbols[Math.floor(Math.random() * chars.symbols.length)]);
    password.push(chars.numbers[Math.floor(Math.random() * chars.numbers.length)]);
    password.push(chars.lower[Math.floor(Math.random() * chars.lower.length)]); // Una minúscula inicial para empezar

    // Rellenar hasta al menos 8 caracteres
    const allChars = chars.lower + chars.upper + chars.numbers + chars.symbols;
    for (let i = password.length; i < 8; i++) {
        password.push(allChars[Math.floor(Math.random() * allChars.length)]);
    }

    // Mezclar para que no siga un patrón predecible
    for (let i = password.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [password[i], password[j]] = [password[j], password[i]];
    }

    return password.join('');
}

async function ConsultarCarritoYResumen(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Carrito y Resumen (Corregida la lógica de precios de calcomanías) ===");

        if (!req.user || !req.user.id_usuario) {
            return res.status(401).json({
                success: false,
                mensaje: 'Acceso no autorizado. El usuario debe estar autenticado para consultar su carrito.'
            });
        }

        const fk_id_usuario = req.user.id_usuario;

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
                c.precio_descuento AS porcentaje_descuento_calcomania -- Ahora es el porcentaje de descuento
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
            let nombre, url_imagen_o_archivo, precio_unidad_calculado, precio_con_descuento, subtotalArticulo;
            let esProducto = item.referencia_producto !== null;

            if (esProducto) {
                nombre = item.nombre_producto;
                url_imagen_o_archivo = item.url_imagen_producto;
                precio_unidad_calculado = parseFloat(item.precio_unidad_producto);
                // Si el producto tiene un precio_descuento, ese es su precio final con descuento
                precio_con_descuento = item.precio_descuento_producto ? parseFloat(item.precio_descuento_producto) : null;
            } else { // Es una calcomanía
                nombre = item.nombre_calcomania;
                url_imagen_o_archivo = item.url_archivo_calcomania;
                let precio_base_calcomania = parseFloat(item.precio_base_calcomania);
                let porcentaje_descuento_calcomania = item.porcentaje_descuento_calcomania ? parseFloat(item.porcentaje_descuento_calcomania) : 0; // Ahora es un porcentaje

                // --- Lógica de cálculo de precio según tamaño para calcomanías ---
                let factorTamano = 1.0;
                switch (item.tamano.toLowerCase()) {
                    case 'pequeño':
                        factorTamano = 1.0; // Precio unidad base
                        break;
                    case 'mediano':
                        factorTamano = 1.25; // 125% del precio base
                        break;
                    case 'grande':
                        factorTamano = 3.00; // 300% del precio base
                        break;
                    default:
                        console.warn(`Tamaño de calcomanía desconocido: ${item.tamano}. Usando precio base.`);
                        factorTamano = 1.0;
                        break;
                }
                
                // Calcular el precio_unidad_calculado SIEMPRE basándose en el precio_base_calcomania y el factor de tamaño
                precio_unidad_calculado = precio_base_calcomania * factorTamano;

                // Ahora, si existe un descuento, aplícalo sobre este precio_unidad_calculado
                if (porcentaje_descuento_calcomania > 0 && porcentaje_descuento_calcomania <= 100) {
                    precio_con_descuento = precio_unidad_calculado * (1 - porcentaje_descuento_calcomania / 100);
                } else {
                    precio_con_descuento = null; // No hay descuento válido
                }
                // --- Fin de la lógica de cálculo de precio por tamaño y descuento ---
            }

            const cantidad = item.cantidad;

            // Siempre sumamos el precio original (ajustado por tamaño para calcomanías) para TotalArticulosSinDescuento
            totalArticulosSinDescuento += precio_unidad_calculado * cantidad;

            if (precio_con_descuento !== null && precio_con_descuento < precio_unidad_calculado) {
                subtotalArticulo = precio_con_descuento * cantidad;
                // El ahorro es la diferencia entre el precio_unidad_calculado y el precio_con_descuento
                descuentoTotalArticulos += (precio_unidad_calculado - precio_con_descuento) * cantidad;
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
                precio_con_descuento: precio_con_descuento ? parseFloat(precio_con_descuento.toFixed(2)) : null,
                subtotalArticulo: parseFloat(subtotalArticulo.toFixed(2))
            });
        });

        const PRECIO_ENVIO = 14900;
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
        console.log("=== DEBUG BACKEND - Finalizar Compra y Registro ===");

        const {
            nombre,
            cedula,
            telefono,
            correo,
            direccion,
            informacion_adicional
        } = req.body;

        if (!nombre || !cedula || !telefono || !correo || !direccion) {
            return res.status(400).json({
                success: false,
                mensaje: 'Los campos nombre, cédula, teléfono, correo y dirección son obligatorios para finalizar la compra.'
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        let fk_id_usuario;
        let esNuevoRegistro = false;
        let contrasenaGenerada = null;
        let usuarioEmail = correo;

        if (req.user && req.user.id_usuario) {
            console.log("Usuario AUTENTICADO. ID:", req.user.id_usuario);
            fk_id_usuario = req.user.id_usuario;

            if (correo !== req.user.correo) {
                console.warn(`[Seguridad] Correo proporcionado (${correo}) no coincide con el del token (${req.user.correo}).`);
                throw new Error('El correo proporcionado no coincide con el de su cuenta autenticada.');
            }

            const [currentUser] = await connection.execute(
                `SELECT nombre, cedula, telefono FROM usuario WHERE id_usuario = ?`,
                [fk_id_usuario]
            );

            let updateFields = [];
            let updateValues = [];

            if (nombre !== currentUser[0].nombre) { updateFields.push('nombre = ?'); updateValues.push(nombre); }
            if (parseInt(cedula, 10) !== currentUser[0].cedula) { updateFields.push('cedula = ?'); updateValues.push(cedula); }
            if (telefono !== currentUser[0].telefono) { updateFields.push('telefono = ?'); updateValues.push(telefono); }

            if (updateFields.length > 0) {
                const updateQuery = `UPDATE usuario SET ${updateFields.join(', ')} WHERE id_usuario = ?`;
                updateValues.push(fk_id_usuario);
                await connection.execute(updateQuery, updateValues);
                console.log(`Usuario ID ${fk_id_usuario} (autenticado) actualizado con nuevos datos.`);
            }

        } else {
            console.log("Usuario NO AUTENTICADO.");

            const [existingUserByEmail] = await connection.execute(
                `SELECT id_usuario, nombre, cedula, telefono FROM usuario WHERE correo = ?`,
                [correo]
            );

            if (existingUserByEmail.length > 0) {
                fk_id_usuario = existingUserByEmail[0].id_usuario;
                console.log("Correo ya registrado, usuario no autenticado. ID:", fk_id_usuario);

                const existingUserData = existingUserByEmail[0];
                let updateFields = [];
                let updateValues = [];

                if (nombre !== existingUserData.nombre) { updateFields.push('nombre = ?'); updateValues.push(nombre); }
                if (parseInt(cedula, 10) !== existingUserData.cedula) { updateFields.push('cedula = ?'); updateValues.push(cedula); }
                if (telefono !== existingUserData.telefono) { updateFields.push('telefono = ?'); updateValues.push(telefono); }

                if (updateFields.length > 0) {
                    const updateQuery = `UPDATE usuario SET ${updateFields.join(', ')} WHERE id_usuario = ?`;
                    updateValues.push(fk_id_usuario);
                    await connection.execute(updateQuery, updateValues);
                    console.log(`Datos de usuario existente (ID: ${fk_id_usuario}, no autenticado) actualizados.`);
                }

            } else {
                console.log("Correo NO registrado. Registrando nuevo usuario automáticamente...");
                esNuevoRegistro = true;
                contrasenaGenerada = generarContrasenaSegura();
                const hashedPassword = await bcrypt.hash(contrasenaGenerada, 10);

                const [insertResult] = await connection.execute(
                    `INSERT INTO usuario (nombre, cedula, telefono, correo, contrasena, estado) VALUES (?, ?, ?, ?, ?, ?)`,
                    [nombre, cedula, telefono, correo, hashedPassword, true]
                );
                fk_id_usuario = insertResult.insertId;

                const [clienteRole] = await connection.execute(
                    `SELECT id_rol FROM rol WHERE nombre = 'cliente'`
                );
                if (clienteRole.length > 0) {
                    await connection.execute(
                        `INSERT INTO usuario_rol (fk_id_usuario, id_rol) VALUES (?, ?)`,
                        [fk_id_usuario, clienteRole[0].id_rol]
                    );
                }
                console.log(`Nuevo usuario registrado automáticamente con ID: ${fk_id_usuario}`);
            }
        }

        await connection.execute(
            `DELETE FROM carrito_compras WHERE FK_id_usuario = ?`,
            [fk_id_usuario]
        );
        console.log(`Carrito de compras limpiado para el usuario ID: ${fk_id_usuario}`);

        await connection.commit();

        if (esNuevoRegistro && usuarioEmail && contrasenaGenerada) {
            await enviarCorreoBienvenida(usuarioEmail, contrasenaGenerada);
            console.log(`Correo de bienvenida enviado a ${usuarioEmail}`);
        }

        res.status(200).json({
            success: true,
            mensaje: 'Información de usuario y carrito procesados exitosamente. Tu compra está lista para ser finalizada en el siguiente paso.',
            nuevo_usuario_registrado: esNuevoRegistro,
            contrasena_generada: esNuevoRegistro ? contrasenaGenerada : undefined
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            console.log("Transacción revertida debido a un error.");
        }
        console.error('Error al procesar la finalización de la compra:', error);
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('correo')) {
            return res.status(409).json({
                success: false,
                mensaje: 'El correo electrónico ya está registrado. Si ya tiene una cuenta, inicie sesión antes de finalizar la compra.'
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