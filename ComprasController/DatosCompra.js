// ... (código existente: pool, bcrypt, enviarCorreoBienvenida, generarContrasenaSegura)

async function ConsultarCarritoYResumen(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Carrito y Resumen ===");

        // --- CAMBIO CLAVE AQUÍ: Permite consultar el carrito sin autenticación ---
        // Si el usuario no está autenticado, podemos usar un ID de sesión o algún otro identificador temporal para el carrito.
        // Asumiendo que el carrito de un invitado se asocia al req.sessionID (si usas express-session)
        // O si ya tienes un identificador de carrito para invitados.
        let fk_id_usuario;
        if (req.user && req.user.id_usuario) {
            fk_id_usuario = req.user.id_usuario;
            console.log("Usuario AUTENTICADO consultando carrito. ID:", fk_id_usuario);
        } else {
            // Esto es un placeholder. Necesitarías una forma de identificar el carrito de un invitado.
            // Por ejemplo, si el ID del carrito se pasa en los headers o la URL, o si está en req.session
            // Por ahora, si no hay usuario, devolverá un error 401 si no hay una forma de identificar el carrito de invitado.
            // Para fines de esta demostración, asumiremos que si no hay req.user, no se puede consultar el carrito.
            // Si deseas soportar carritos de invitado, la lógica de FK_id_usuario y carrito_compras debe adaptarse.
            return res.status(401).json({
                success: false,
                mensaje: 'Acceso no autorizado. El usuario debe estar autenticado para consultar su carrito, o la funcionalidad de carrito de invitado no está implementada para esta ruta.'
            });
            // Si manejas carritos de invitado en la DB, tendrías que tener un FK_id_session o similar
            // Y pasar el req.sessionID aquí, o un ID de carrito generado por el frontend.
            // Por ejemplo: fk_id_usuario = req.sessionID; // Si tu tabla carrito_compras usa sessionID para invitados
            // Luego, la consulta SQL para carrito_compras tendría que buscar por FK_id_usuario O FK_id_sesion
        }

        // 1. Obtener los artículos del carrito (productos y calcomanías)
        // ... (el resto de tu lógica de ConsultarCarritoYResumen permanece igual)
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

                // --- Lógica de cálculo de precio según tamaño para calcomanías (CORREGIDA) ---
                switch (item.tamano.toLowerCase()) {
                    case 'pequeño':
                        // Precio base, sin incremento
                        precio_unidad_calculado = precio_base_calcomania;
                        precio_descuento_calculado = precio_descuento_base_calcomania;
                        break;
                    case 'mediano':
                        // Precio base + 125% del precio base (lo que es igual a multiplicarlo por 2.25)
                        precio_unidad_calculado = precio_base_calcomania * 2.25;
                        precio_descuento_calculado = precio_descuento_base_calcomania ? precio_descuento_base_calcomania * 2.25 : null;
                        break;
                    case 'grande':
                        // Precio base + 300% del precio base (lo que es igual a multiplicarlo por 4.00)
                        precio_unidad_calculado = precio_base_calcomania * 4.00;
                        precio_descuento_calculado = precio_descuento_base_calcomania ? precio_descuento_base_calcomania * 4.00 : null;
                        break;
                    default:
                        // Si el tamaño no es reconocido, se usa el precio base sin modificaciones.
                        console.warn(`Tamaño de calcomanía desconocido: ${item.tamano}. Usando precio base.`);
                        precio_unidad_calculado = precio_base_calcomania;
                        precio_descuento_calculado = precio_descuento_base_calcomania;
                        break;
                }
                // --- Fin de la lógica de cálculo de precio por tamaño ---
            }

            const cantidad = item.cantidad;

            // Calcular subtotalArticulo y contribuir a los totales generales
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

        // 2. Calcular el resumen del pedido
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
        console.log("=== DEBUG BACKEND - Finalizar Compra y Registro (Corregida) ===");

        // --- DEBUG PASO 1: Revisar el contenido de la sesión al inicio ---
        console.log("DEBUG 1: Contenido completo de req.session:", JSON.stringify(req.session, null, 2));
        console.log("DEBUG 1: Contenido de req.session.checkout:", JSON.stringify(req.session.checkout, null, 2));
        console.log("DEBUG 1: Contenido de req.session.checkout.direccion_envio:", JSON.stringify(req.session.checkout && req.session.checkout.direccion_envio, null, 2));


        // --- OBTENER DATOS DEL USUARIO Y DIRECCIÓN DESDE LA SESIÓN ---
        const checkoutData = req.session.checkout && req.session.checkout.direccion_envio;

        // --- DEBUG PASO 2: Verificar el valor de 'checkoutData' extraído ---
        console.log("DEBUG 2: Valor de 'checkoutData' (direccion_envio) extraído:", JSON.stringify(checkoutData, null, 2));


        if (!checkoutData || !checkoutData.nombre || !checkoutData.cedula || !checkoutData.telefono || !checkoutData.correo || !checkoutData.direccion) {
            // --- DEBUG PASO 3: Indicar qué campo específico falta si la validación falla ---
            if (!checkoutData) console.log("DEBUG ERROR 3: 'checkoutData' es undefined o null.");
            if (checkoutData && !checkoutData.nombre) console.log("DEBUG ERROR 3: Falta 'nombre' en checkoutData.");
            if (checkoutData && !checkoutData.cedula) console.log("DEBUG ERROR 3: Falta 'cedula' en checkoutData.");
            if (checkoutData && !checkoutData.telefono) console.log("DEBUG ERROR 3: Falta 'telefono' en checkoutData.");
            if (checkoutData && !checkoutData.correo) console.log("DEBUG ERROR 3: Falta 'correo' en checkoutData.");
            if (checkoutData && !checkoutData.direccion) console.log("DEBUG ERROR 3: Falta 'direccion' en checkoutData.");

            return res.status(400).json({
                success: false,
                mensaje: 'Información de usuario o dirección de envío incompleta en la sesión. Por favor, vuelva a la sección de dirección.'
            });
        }

        const { nombre, cedula, telefono, correo, direccion, informacion_adicional } = checkoutData;

        // --- DEBUG PASO 4: Mostrar los datos individuales extraídos ---
        console.log("DEBUG 4: Datos extraídos - Nombre:", nombre);
        console.log("DEBUG 4: Datos extraídos - Cédula:", cedula);
        console.log("DEBUG 4: Datos extraídos - Teléfono:", telefono);
        console.log("DEBUG 4: Datos extraídos - Correo:", correo);
        console.log("DEBUG 4: Datos extraídos - Dirección:", direccion);
        console.log("DEBUG 4: Datos extraídos - Información Adicional:", informacion_adicional);


        connection = await pool.getConnection();
        await connection.beginTransaction();

        let fk_id_usuario;
        let esNuevoRegistro = false;
        let contrasenaGenerada = null;
        let usuarioEmail = correo;

        // 1. Determinar el usuario y si necesita ser registrado o actualizado
        if (req.user && req.user.id_usuario) {
            // --- Usuario AUTENTICADO por Token ---
            console.log("Usuario AUTENTICADO. ID:", req.user.id_usuario);
            fk_id_usuario = req.user.id_usuario;

            // Verificar que el correo del token coincida con el correo guardado en sesión
            if (correo !== req.user.correo) {
                console.warn(`[Seguridad] Correo proporcionado en sesión (${correo}) no coincide con el del token (${req.user.correo}).`);
                throw new Error('El correo asociado a la compra no coincide con su cuenta autenticada. Por favor, inicie sesión con el correo correcto.');
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

        // 2. Mover el carrito del usuario a la factura
        // Primero, obtener los artículos del carrito del usuario (¡Importante: usa fk_id_usuario aquí!)
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
        let totalArticulosSinDescuento = 0; // Necesario para calcular el descuento de forma precisa

        carritoItems.forEach(item => {
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
                        precio_unidad_calculado = precio_base_calcomania * 2.25; // Precio base + 125%
                        precio_descuento_calculado = precio_descuento_base_calcomania ? precio_descuento_base_calcomania * 2.25 : null;
                        break;
                    case 'grande':
                        precio_unidad_calculado = precio_base_calcomania * 4.00; // Precio base + 300%
                        precio_descuento_calculado = precio_descuento_base_calcomania ? precio_descuento_base_calcomania * 4.00 : null;
                        break;
                    default:
                        precio_unidad_calculado = precio_base_calcomania;
                        precio_descuento_calculado = precio_descuento_base_calcomania;
                        break;
                }
            }

            const cantidad = item.cantidad;
            totalArticulosSinDescuento += precio_unidad_calculado * cantidad;

            if (precio_descuento_calculado !== null && precio_descuento_calculado < precio_unidad_calculado) {
                totalArticulosFinal += precio_descuento_calculado * cantidad;
                descuentoTotalArticulos += (precio_unidad_calculado - precio_descuento_calculado) * cantidad;
            } else {
                totalArticulosFinal += precio_unidad_calculado * cantidad;
            }
        });

        const PRECIO_ENVIO = 14900; // Precio de envío en COP
        const subtotalFactura = parseFloat(totalArticulosFinal.toFixed(2));
        const totalFactura = parseFloat((subtotalFactura + PRECIO_ENVIO).toFixed(2));
        const descuentoAplicado = parseFloat(descuentoTotalArticulos.toFixed(2)); // Suma de todos los descuentos

        // Insertar la factura principal
        const [facturaResult] = await connection.execute(
            `INSERT INTO factura (fk_id_usuario, fecha_venta, total, subtotal, descuento, precio_envio, direccion, informacion_adicional, estado_pedido) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
            [fk_id_usuario, totalFactura, subtotalFactura, descuentoAplicado, PRECIO_ENVIO, direccion, informacion_adicional, 'Pendiente']
        );
        const id_factura = facturaResult.insertId;
        console.log(`Factura creada con ID: ${id_factura} para usuario ID: ${fk_id_usuario}`);

        // Insertar los detalles de la factura
        for (const item of carritoItems) {
            let precio_unitario_factura;
            let precio_descuento_factura;

            if (item.referencia_producto !== null) { // Es un producto
                precio_unitario_factura = parseFloat(item.precio_unidad_producto);
                precio_descuento_factura = item.precio_descuento_producto ? parseFloat(item.precio_descuento_producto) : null;
            } else { // Es una calcomanía
                let precio_base_calcomania = parseFloat(item.precio_base_calcomania);
                let precio_descuento_base_calcomania = item.precio_descuento_calcomania_base ? parseFloat(item.precio_descuento_calcomania_base) : null;

                switch (item.tamano.toLowerCase()) {
                    case 'pequeño':
                        precio_unitario_factura = precio_base_calcomania;
                        precio_descuento_factura = precio_descuento_base_calcomania;
                        break;
                    case 'mediano':
                        precio_unitario_factura = precio_base_calcomania * 2.25;
                        precio_descuento_factura = precio_descuento_base_calcomania ? precio_descuento_base_calcomania * 2.25 : null;
                        break;
                    case 'grande':
                        precio_unitario_factura = precio_base_calcomania * 4.00;
                        precio_descuento_factura = precio_descuento_base_calcomania ? precio_descuento_base_calcomania * 4.00 : null;
                        break;
                    default:
                        precio_unitario_factura = precio_base_calcomania;
                        precio_descuento_factura = precio_descuento_base_calcomania;
                        break;
                }
            }

            await connection.execute(
                `INSERT INTO detalle_factura (FK_id_factura, FK_referencia_producto, FK_id_calcomania, cantidad, precio_unitario, precio_descuento, tamano_calcomania) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    id_factura,
                    item.referencia_producto,
                    item.id_calcomania,
                    item.cantidad,
                    parseFloat(precio_unitario_factura.toFixed(2)), // Precio antes de cualquier descuento directo del artículo
                    precio_descuento_factura ? parseFloat(precio_descuento_factura.toFixed(2)) : null, // Precio con descuento directo del artículo
                    item.id_calcomania ? item.tamano : null // Solo para calcomanías
                ]
            );
        }
        console.log(`Detalles de factura insertados para la factura ID: ${id_factura}`);

        // 3. Limpiar el carrito de compras del usuario
        // Esto se hace siempre al "finalizar" esta etapa, ya que los artículos se han procesado en la factura.
        await connection.execute(
            `DELETE FROM carrito_compras WHERE FK_id_usuario = ?`,
            [fk_id_usuario]
        );
        console.log(`Carrito de compras limpiado para el usuario ID: ${fk_id_usuario}`);

        // 4. Limpiar la información de envío de la sesión una vez completada la compra
        if (req.session.checkout) {
            delete req.session.checkout.direccion_envio;
            console.log("Información de dirección de envío eliminada de la sesión.");
            // --- DEBUG PASO 5: Verificar que se borró de la sesión ---
            console.log("DEBUG 5: req.session.checkout después de limpiar direccion_envio:", JSON.stringify(req.session.checkout, null, 2));
        }


        await connection.commit(); // Confirmar la transacción

        // 5. Enviar correo de bienvenida si es un nuevo registro
        if (esNuevoRegistro && usuarioEmail && contrasenaGenerada) {
            await enviarCorreoBienvenida(usuarioEmail, contrasenaGenerada);
            console.log(`Correo de bienvenida enviado a ${usuarioEmail}`);
        }

        res.status(200).json({
            success: true,
            mensaje: '¡Compra finalizada exitosamente! Tu pedido está en camino.',
            id_factura: id_factura,
            nuevo_usuario_registrado: esNuevoRegistro,
            contrasena_generada: esNuevoRegistro ? contrasenaGenerada : undefined, // Solo si es nuevo registro
            total_factura: totalFactura
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