const pool = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto'); // Necesario para generar bytes aleatorios

// Se ha eliminado la línea de importación de EmailSender.js

function generarContrasenaSegura() {
    // Genera 8 bytes aleatorios y los convierte a una cadena hexadecimal (16 caracteres)
    return crypto.randomBytes(8).toString('hex');
}

async function DireccionEnvio(req, res) {
    let connection;
    try {
        console.log("=== DEBUG BACKEND - Función DireccionEnvio ===");
        console.log("DEBUG: req.user (desde token, si existe):", req.user);

        const {
            nombre,
            cedula,
            telefono,
            correo,
            direccion,
            informacion_adicional,
            carrito // Datos del carrito desde el frontend (Opcional si usuario logeado)
        } = req.body;

        console.log("DEBUG 1: Datos recibidos en req.body:", JSON.stringify(req.body, null, 2));

        // 1. Validación de campos obligatorios para datos de envío
        if (!nombre || !cedula || !telefono || !correo || !direccion) {
            console.log("DEBUG ERROR: Datos de envío obligatorios faltantes.");
            return res.status(400).json({
                success: false,
                mensaje: 'Los campos nombre, cédula, teléfono, correo y dirección son obligatorios.'
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        let fk_id_usuario;
        let esNuevoRegistro = false; // Flag para saber si se registró un nuevo usuario
        let contrasenaGenerada = null; // Para almacenar la contraseña generada si aplica (pero no se usará por ahora)
        let carritoDesdeDB = []; // Para almacenar los ítems del carrito, ya sea del frontend o DB

        // 2. Manejo del Usuario (Autenticado o Invitado)
        if (req.user && req.user.id_usuario) {
            // --- Usuario AUTENTICADO ---
            console.log("Usuario AUTENTICADO. ID:", req.user.id_usuario);
            fk_id_usuario = req.user.id_usuario;

            const [userCheck] = await connection.execute(
                `SELECT nombre, cedula, telefono, correo FROM usuario WHERE id_usuario = ?`,
                [fk_id_usuario]
            );

            if (userCheck.length === 0) {
                console.error("ERROR: Usuario autenticado no encontrado en la base de datos con ID:", fk_id_usuario);
                await connection.rollback();
                return res.status(401).json({
                    success: false,
                    mensaje: 'Usuario autenticado no encontrado en la base de datos.'
                });
            }

            const currentUser = userCheck[0];
            let updateFields = [];
            let updateValues = [];

            // Actualizar datos del usuario si hay cambios (excepto correo, ya verificado por token)
            if (nombre !== currentUser.nombre) { updateFields.push('nombre = ?'); updateValues.push(nombre); }
            if (parseInt(cedula, 10) !== currentUser.cedula) { updateFields.push('cedula = ?'); updateValues.push(cedula); }
            if (telefono !== currentUser.telefono) { updateFields.push('telefono = ?'); updateValues.push(telefono); }
            // Comprobación de correo: Si está autenticado, el correo del body DEBE COINCIDIR con el del token.
            if (correo !== currentUser.correo) {
                console.warn(`[Seguridad] Correo proporcionado en body (${correo}) no coincide con el del token (${currentUser.correo}).`);
                await connection.rollback();
                return res.status(403).json({
                    success: false,
                    mensaje: 'El correo proporcionado no coincide con el de su cuenta autenticada. Por favor, inicie sesión con el correo correcto o cierre sesión para realizar una compra como invitado.'
                });
            }

            if (updateFields.length > 0) {
                const updateQuery = `UPDATE usuario SET ${updateFields.join(', ')} WHERE id_usuario = ?`;
                updateValues.push(fk_id_usuario);
                await connection.execute(updateQuery, updateValues);
                console.log(`Usuario ID ${fk_id_usuario} actualizado con nuevos datos en DB.`);
            }

            // Para usuarios logeados, OBTENER EL CARRITO DIRECTAMENTE DE LA BASE DE DATOS
            const [dbCartItems] = await connection.execute(
                `SELECT
                    cc.FK_referencia_producto AS id_producto,
                    cc.FK_id_calcomania AS id_calcomania,
                    cc.cantidad,
                    cc.tamano,
                    CASE
                        WHEN cc.FK_referencia_producto IS NOT NULL THEN 'producto'
                        WHEN cc.FK_id_calcomania IS NOT NULL THEN 'calcomania'
                        ELSE NULL
                    END AS tipo
                FROM carrito_compras cc
                WHERE cc.FK_id_usuario = ?`,
                [fk_id_usuario]
            );

            carritoDesdeDB = dbCartItems;
            console.log(`Carrito cargado desde DB para usuario logeado ID ${fk_id_usuario}:`, carritoDesdeDB);

        } else {
            // --- Usuario NO AUTENTICADO (Invitado) ---
            console.log("Usuario NO AUTENTICADO. Intentando encontrar o registrar.");

            // Validar que el carrito NO esté vacío para usuarios no autenticados
            if (!carrito || !Array.isArray(carrito) || carrito.length === 0) {
                console.log("DEBUG ERROR: Carrito vacío o inválido para usuario no autenticado.");
                await connection.rollback(); // Asegurarse de hacer rollback
                return res.status(400).json({
                    success: false,
                    mensaje: 'Para finalizar la compra como invitado, su carrito no puede estar vacío.'
                });
            }
            carritoDesdeDB = carrito; // Usar el carrito enviado por el frontend

            const [existingUserByEmail] = await connection.execute(
                `SELECT id_usuario, nombre, cedula, telefono, correo FROM usuario WHERE correo = ?`,
                [correo]
            );

            if (existingUserByEmail.length > 0) {
                // El correo existe, usar su ID y actualizar datos si es necesario
                fk_id_usuario = existingUserByEmail[0].id_usuario;
                console.log("Correo ya registrado, usuario no autenticado. Usando ID:", fk_id_usuario);

                const existingUser = existingUserByEmail[0];
                let updateFields = [];
                let updateValues = [];

                if (nombre !== existingUser.nombre) { updateFields.push('nombre = ?'); updateValues.push(nombre); }
                if (parseInt(cedula, 10) !== existingUser.cedula) { updateFields.push('cedula = ?'); updateValues.push(cedula); }
                if (telefono !== existingUser.telefono) { updateFields.push('telefono = ?'); updateValues.push(telefono); }

                if (updateFields.length > 0) {
                    const updateQuery = `UPDATE usuario SET ${updateFields.join(', ')} WHERE id_usuario = ?`;
                    updateValues.push(fk_id_usuario);
                    await connection.execute(updateQuery, updateValues);
                    console.log(`Datos de usuario existente (ID: ${fk_id_usuario}, no autenticado) actualizados en DB.`);
                }

            } else {
                // El correo NO existe, REGISTRAR un nuevo usuario
                console.log("Correo NO registrado en DB. Registrando nuevo usuario y generando contraseña.");
                esNuevoRegistro = true; // Es un nuevo registro

                contrasenaGenerada = generarContrasenaSegura(); // Se genera, pero no se usa ni se envía
                const hashedPassword = await bcrypt.hash(contrasenaGenerada, 10); // Hashear para guardar

                const [result] = await connection.execute(
                    `INSERT INTO usuario (nombre, cedula, telefono, correo, contrasena, estado) VALUES (?, ?, ?, ?, ?, ?)`,
                    [nombre, cedula, telefono, correo, hashedPassword, true] // Estado true por defecto
                );
                fk_id_usuario = result.insertId;

                // Asignar el rol 'cliente' al nuevo usuario
                const [clienteRole] = await connection.execute(
                    `SELECT id_rol FROM rol WHERE nombre = 'cliente'`
                );
                if (clienteRole.length > 0) {
                    await connection.execute(
                        `INSERT INTO usuario_rol (fk_id_usuario, id_rol) VALUES (?, ?)`,
                        [fk_id_usuario, clienteRole[0].id_rol]
                    );
                    console.log(`Rol 'cliente' asignado al nuevo usuario ID: ${fk_id_usuario}`);
                } else {
                    console.warn("Advertencia: No se encontró el rol 'cliente' en la base de datos.");
                }
                console.log(`Nuevo usuario registrado automáticamente con ID: ${fk_id_usuario}`);
            }
        }

        // Validación final del carrito_desde_DB después de todo el procesamiento de usuario
        if (!carritoDesdeDB || !Array.isArray(carritoDesdeDB) || carritoDesdeDB.length === 0) {
            console.log("DEBUG ERROR: Carrito vacío o inválido después de determinar el usuario.");
            await connection.rollback();
            return res.status(400).json({
                success: false,
                mensaje: 'No se encontraron artículos en su carrito. Por favor, añada artículos antes de continuar.'
            });
        }


        // 3. Crear la FACTURA con los datos de envío
        const fecha_venta = new Date(); // Fecha actual
        const [facturaResult] = await connection.execute(
            `INSERT INTO factura (fk_id_usuario, fecha_venta, direccion, informacion_adicional, valor_total, metodo_pago, valor_envio)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [fk_id_usuario, fecha_venta, direccion, informacion_adicional || null, 0.00, null, 0.00] // Estado inicial y pago Wompi
        );
        const id_factura = facturaResult.insertId;
        console.log(`Nueva factura (ID: ${id_factura}) creada con datos de envío para usuario ID: ${fk_id_usuario}.`);


        // 4. Limpiar y Repoblar el CARRITO_COMPRAS en la DB si es un usuario invitado/nuevo
        if (!req.user || esNuevoRegistro) { // Si no está logeado O si es un registro nuevo (viene de invitado)
            await connection.execute(
                `DELETE FROM carrito_compras WHERE FK_id_usuario = ?`,
                [fk_id_usuario]
            );
            console.log(`Carrito de compras existente en DB limpiado para el usuario ID: ${fk_id_usuario}`);

            // Insertar los nuevos artículos del carrito que vinieron del frontend (o se cargaron para el usuario logeado)
            for (const item of carritoDesdeDB) { // Usamos carritoDesdeDB que contiene los ítems correctos
                if (!item.cantidad || item.cantidad <= 0) {
                    console.warn("DEBUG ADVERTENCIA: Ítem de carrito con cantidad inválida:", item);
                    continue;
                }
                const fk_referencia_producto = item.tipo === 'producto' ? item.id_producto : null;
                const fk_id_calcomania = item.tipo === 'calcomania' ? item.id_calcomania : null;
                const tamano_calcomania = item.tipo === 'calcomania' ? item.tamano : null;

                if (!fk_referencia_producto && !fk_id_calcomania) {
                    console.warn("DEBUG ADVERTENCIA: Ítem de carrito sin FK_referencia_producto ni FK_id_calcomania:", item);
                    continue;
                }

                await connection.execute(
                    `INSERT INTO carrito_compras (FK_id_usuario, FK_referencia_producto, FK_id_calcomania, cantidad, tamano)
                     VALUES (?, ?, ?, ?, ?)`,
                    [fk_id_usuario, fk_referencia_producto, fk_id_calcomania, item.cantidad, tamano_calcomania]
                );
                console.log(`DEBUG: Ítem añadido a CARRITO_COMPRAS para usuario ${fk_id_usuario}: `, item);
            }
            console.log(`Carrito de compras para usuario ID: ${fk_id_usuario} (nuevo/invitado) repoblado en DB.`);
        } else {
             console.log(`Usuario logeado. Se asume que el carrito en la DB es la fuente de verdad y no se repobló.`);
        }


        // 5. Almacenar información relevante en la sesión para el siguiente paso (FinalizarCompraYRegistro)
        req.session.checkout = req.session.checkout || {};
        req.session.checkout.id_factura_temp = id_factura; // Guardamos el ID de la factura creada
        req.session.checkout.fk_id_usuario_para_compra = fk_id_usuario;
        req.session.checkout.es_nuevo_registro = esNuevoRegistro;
        req.session.checkout.correo_cliente_factura = correo; // Guardamos el correo para usarlo en Wompi
        if (esNuevoRegistro) {
            req.session.checkout.contrasena_generada = contrasenaGenerada;
            // No se envía el correo con la contraseña generada en este momento,
            // pero la contraseña se guarda en la DB y en la sesión si es un nuevo registro.
        }

        console.log("DEBUG: ID de factura, flags de usuario y contraseña (si aplica) guardados en la sesión.");

        await connection.commit();
        console.log("DEBUG: Transacción de DireccionEnvio completada y datos guardados en DB.");

        req.session.save((err) => {
            if (err) {
                console.error("DEBUG ERROR: Error al guardar la sesión después de DireccionEnvio:", err);
                return res.status(500).json({ success: false, mensaje: 'Error interno del servidor al guardar la información de la sesión.' });
            }
            console.log("DEBUG: Sesión guardada exitosamente después de DireccionEnvio.");

            res.status(200).json({
                success: true,
                mensaje: 'Información de envío y factura inicial procesadas. Puedes continuar con la compra.',
                id_factura_creada: id_factura, // Se retorna el ID de la factura creada
                nuevo_usuario_registrado: esNuevoRegistro,
                datos_usuario_para_checkout: { // Estos son los datos del usuario tal como se ingresaron
                    nombre,
                    cedula,
                    telefono,
                    correo,
                    direccion,
                    informacion_adicional
                },
                // La contraseña generada no se retorna al frontend por seguridad,
                // ya que no se está enviando por correo.
            });
        });

    } catch (error) {
        console.error('Error en la función DireccionEnvio:', error);
        if (connection) {
            try {
                await connection.rollback();
                console.log("DEBUG: Transacción de DireccionEnvio revertida debido a un error.");
            } catch (rollbackError) {
                console.error("DEBUG ERROR: Error al hacer rollback:", rollbackError);
            }
        }
        // Manejar errores específicos como correo duplicado si ocurre en la fase de INSERT
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('correo')) {
            return res.status(409).json({ // 409 Conflict
                success: false,
                mensaje: 'El correo electrónico ya está registrado. Si ya tiene una cuenta, inicie sesión antes de finalizar la compra.'
            });
        }
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al procesar la dirección de envío o el carrito.'
        });
    } finally {
        if (connection) {
            connection.release();
            console.log("DEBUG: Conexión a la DB liberada.");
        }
    }
}

module.exports = {
    DireccionEnvio
};