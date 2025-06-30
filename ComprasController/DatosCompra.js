const pool = require('../db');
const bcrypt = require('bcrypt');
const { enviarCorreoBienvenida } = require('../templates/UsuarioNoRegistrado'); // Ajusta la ruta a tu archivo de servicio de correo

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
        console.log("=== DEBUG BACKEND - Consultar Carrito y Resumen ===");

        // Asegurarse de que el usuario esté autenticado. Esta función es solo para usuarios con sesión iniciada.
        if (!req.user || !req.user.id_usuario) {
            return res.status(401).json({
                success: false,
                mensaje: 'Acceso no autorizado. El usuario debe estar autenticado para consultar su carrito.'
            });
        }

        const fk_id_usuario = req.user.id_usuario;

        // 1. Obtener los artículos del carrito (productos y calcomanías)
        const [carritoItems] = await pool.execute(
            `SELECT
                cc.FK_referencia_producto AS referencia_producto,
                cc.FK_id_calcomania AS id_calcomania,
                cc.cantidad,
                cc.tamano, -- Solo relevante para calcomanías
                p.nombre AS nombre_producto,
                p.precio_unidad AS precio_unidad_producto,
                p.precio_descuento AS precio_descuento_producto,
                (SELECT url_imagen FROM producto_imagen pi WHERE pi.FK_referencia_producto = p.referencia ORDER BY pi.id_imagen ASC LIMIT 1) AS url_imagen_producto,
                c.nombre AS nombre_calcomania,
                c.url_archivo AS url_archivo_calcomania,
                c.precio_unidad AS precio_unidad_calcomania,
                c.precio_descuento AS precio_descuento_calcomania
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
        let totalArticulosSinDescuento = 0; // Suma de (precio_unidad_original * cantidad)
        let descuentoTotalArticulos = 0;    // Suma del ahorro total por descuentos
        let totalArticulosFinal = 0;        // Suma de (precio_final_aplicado * cantidad)

        carritoItems.forEach(item => {
            let nombre, url_imagen_o_archivo, precio_unidad, precio_descuento, subtotalArticulo;
            let esProducto = item.referencia_producto !== null;

            if (esProducto) {
                nombre = item.nombre_producto;
                url_imagen_o_archivo = item.url_imagen_producto;
                precio_unidad = parseFloat(item.precio_unidad_producto);
                precio_descuento = item.precio_descuento_producto ? parseFloat(item.precio_descuento_producto) : null;
            } else { // Es una calcomanía
                nombre = item.nombre_calcomania;
                url_imagen_o_archivo = item.url_archivo_calcomania;
                precio_unidad = parseFloat(item.precio_unidad_calcomania);
                precio_descuento = item.precio_descuento_calcomania ? parseFloat(item.precio_descuento_calcomania) : null;
            }

            const cantidad = item.cantidad;

            // Calcular subtotalArticulo y contribuir a los totales generales
            totalArticulosSinDescuento += precio_unidad * cantidad; // Siempre suma el precio original para TotalArticulos

            if (precio_descuento !== null && precio_descuento < precio_unidad) {
                subtotalArticulo = precio_descuento * cantidad;
                descuentoTotalArticulos += (precio_unidad - precio_descuento) * cantidad;
            } else {
                subtotalArticulo = precio_unidad * cantidad;
            }
            totalArticulosFinal += subtotalArticulo;


            articulosEnCarrito.push({
                referencia_producto: item.referencia_producto,
                id_calcomania: item.id_calcomania,
                nombre: nombre,
                url_imagen_o_archivo: url_imagen_o_archivo,
                cantidad: cantidad,
                tamano: item.tamano, // Incluir tamaño para calcomanías si aplica
                precio_unidad_original: parseFloat(precio_unidad.toFixed(2)), // Precio sin descuento
                precio_con_descuento: precio_descuento ? parseFloat(precio_descuento.toFixed(2)) : null, // Precio con descuento
                subtotalArticulo: parseFloat(subtotalArticulo.toFixed(2)) // Cantidad * precio_con_descuento o precio_unidad
            });
        });

        // 2. Calcular el resumen del pedido
        const PRECIO_ENVIO = 14900; // Valor fijo del envío
        const subtotalPedido = parseFloat((totalArticulosFinal).toFixed(2)); // Suma de los subtotales de artículos ya con descuento
        const totalPedido = parseFloat((subtotalPedido + PRECIO_ENVIO).toFixed(2));

        const resumenPedido = {
            TotalArticulosSinDescuento: parseFloat(totalArticulosSinDescuento.toFixed(2)), // Suma de (precio_unidad * cantidad) de todos los ítems
            DescuentoArticulos: parseFloat(descuentoTotalArticulos.toFixed(2)), // Ahorro total por descuentos
            Subtotal: subtotalPedido, // Precio de los artículos después de aplicar descuentos (TotalArticulosSinDescuento - DescuentoArticulos)
            PrecioEnvio: PRECIO_ENVIO,
            Total: totalPedido // (Subtotal + PrecioEnvio)
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
    let connection; // Declarar la conexión fuera del try para que esté disponible en finally
    try {
        console.log("=== DEBUG BACKEND - Finalizar Compra y Registro (Corregida) ===");

        // Aseguramos que los datos necesarios para el usuario siempre vengan en el body
        const {
            nombre,
            cedula,
            telefono,
            correo,
            direccion, // Se espera para la interfaz, pero no se guarda en factura aquí
            informacion_adicional // Se espera para la interfaz, pero no se guarda en factura aquí
        } = req.body;

        // Validar que los datos de contacto y dirección sean obligatorios
        if (!nombre || !cedula || !telefono || !correo || !direccion) {
            return res.status(400).json({
                success: false,
                mensaje: 'Los campos nombre, cédula, teléfono, correo y dirección son obligatorios para finalizar la compra.'
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction(); // Iniciar transacción

        let fk_id_usuario;
        let esNuevoRegistro = false;
        let contrasenaGenerada = null;
        let usuarioEmail = correo; // Usamos el correo del body como el correo principal para esta operación

        // 1. Determinar el usuario y si necesita ser registrado o actualizado
        if (req.user && req.user.id_usuario) {
            // --- Usuario AUTENTICADO por Token ---
            console.log("Usuario AUTENTICADO. ID:", req.user.id_usuario);
            fk_id_usuario = req.user.id_usuario;

            // Verificar que el correo del token coincida con el correo del body para seguridad
            if (correo !== req.user.correo) {
                console.warn(`[Seguridad] Correo proporcionado (${correo}) no coincide con el del token (${req.user.correo}).`);
                throw new Error('El correo proporcionado no coincide con el de su cuenta autenticada.');
            }

            // Actualizar datos del usuario existente si son diferentes
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
            // --- Usuario NO AUTENTICADO ---
            console.log("Usuario NO AUTENTICADO.");

            // Buscar si el correo ya existe en la tabla USUARIO
            const [existingUserByEmail] = await connection.execute(
                `SELECT id_usuario, nombre, cedula, telefono FROM usuario WHERE correo = ?`,
                [correo]
            );

            if (existingUserByEmail.length > 0) {
                // Usuario EXISTE en DB pero NO AUTENTICADO: Usamos su ID existente y actualizamos.
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
                // Usuario NO EXISTE en la DB: Proceder con el registro automático
                console.log("Correo NO registrado. Registrando nuevo usuario automáticamente...");
                esNuevoRegistro = true;
                contrasenaGenerada = generarContrasenaSegura();
                const hashedPassword = await bcrypt.hash(contrasenaGenerada, 10);

                const [insertResult] = await connection.execute(
                    `INSERT INTO usuario (nombre, cedula, telefono, correo, contrasena, estado) VALUES (?, ?, ?, ?, ?, ?)`,
                    [nombre, cedula, telefono, correo, hashedPassword, true] // Estado true por defecto
                );
                fk_id_usuario = insertResult.insertId;

                // Asignar el rol 'cliente' al nuevo usuario
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

        // 2. Limpiar el carrito de compras del usuario
        // Esto se hace siempre al "finalizar" esta etapa, ya que se asume que los artículos se van a procesar.
        await connection.execute(
            `DELETE FROM carrito_compras WHERE FK_id_usuario = ?`,
            [fk_id_usuario]
        );
        console.log(`Carrito de compras limpiado para el usuario ID: ${fk_id_usuario}`);

        await connection.commit(); // Confirmar la transacción (registro/actualización de usuario y limpieza de carrito)

        // 3. Enviar correo de bienvenida si es un nuevo registro
        if (esNuevoRegistro && usuarioEmail && contrasenaGenerada) {
            await enviarCorreoBienvenida(usuarioEmail, contrasenaGenerada);
            console.log(`Correo de bienvenida enviado a ${usuarioEmail}`);
        }

        res.status(200).json({
            success: true,
            mensaje: 'Información de usuario y carrito procesados exitosamente. Tu compra está lista para ser finalizada en el siguiente paso.',
            nuevo_usuario_registrado: esNuevoRegistro,
            contrasena_generada: esNuevoRegistro ? contrasenaGenerada : undefined // Solo si es nuevo registro
        });

    } catch (error) {
        if (connection) {
            await connection.rollback(); // Revertir la transacción si algo falla
            console.log("Transacción revertida debido a un error.");
        }
        console.error('Error al procesar la finalización de la compra:', error);
        // Manejar errores específicos como correo duplicado
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('correo')) {
            return res.status(409).json({ // 409 Conflict
                success: false,
                mensaje: 'El correo electrónico ya está registrado. Si ya tiene una cuenta, inicie sesión antes de finalizar la compra.'
            });
        }
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al procesar su solicitud.'
        });
    } finally {
        if (connection) connection.release(); // Liberar la conexión
    }
}


module.exports = {
    ConsultarCarritoYResumen,
    FinalizarCompraYRegistro
};