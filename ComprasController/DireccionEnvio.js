const pool = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Re-importar el servicio de correo
const { enviarCorreoBienvenida } = require('../templates/UsuarioNoRegistrado');

function generarContrasenaSegura() {
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
        let esNuevoRegistro = false;
        let contrasenaGenerada = null;
        let carritoDesdeDB = [];

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

            if (nombre !== currentUser.nombre) { updateFields.push('nombre = ?'); updateValues.push(nombre); }
            if (parseInt(cedula, 10) !== currentUser.cedula) { updateFields.push('cedula = ?'); updateValues.push(cedula); }
            if (telefono !== currentUser.telefono) { updateFields.push('telefono = ?'); updateValues.push(telefono); }
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

            if (!carrito || !Array.isArray(carrito) || carrito.length === 0) {
                console.log("DEBUG ERROR: Carrito vacío o inválido para usuario no autenticado.");
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    mensaje: 'Para finalizar la compra como invitado, su carrito no puede estar vacío.'
                });
            }
            carritoDesdeDB = carrito;

            const [existingUserByEmail] = await connection.execute(
                `SELECT id_usuario, nombre, cedula, telefono, correo FROM usuario WHERE correo = ?`,
                [correo]
            );

            if (existingUserByEmail.length > 0) {
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
                console.log("Correo NO registrado en DB. Registrando nuevo usuario y generando contraseña.");
                esNuevoRegistro = true;

                contrasenaGenerada = generarContrasenaSegura();
                const hashedPassword = await bcrypt.hash(contrasenaGenerada, 10);

                const [result] = await connection.execute(
                    `INSERT INTO usuario (nombre, cedula, telefono, correo, contrasena, estado) VALUES (?, ?, ?, ?, ?, ?)`,
                    [nombre, cedula, telefono, correo, hashedPassword, true]
                );
                fk_id_usuario = result.insertId;

                const [clienteRole] = await connection.execute(`SELECT id_rol FROM rol WHERE nombre = 'cliente'`);
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

                if (correo) {
                    const correoEnviado = await enviarCorreoBienvenida(correo, contrasenaGenerada);
                    if (correoEnviado) {
                        console.log(`Correo de bienvenida con contraseña enviado a ${correo}`);
                    } else {
                        console.warn(`Falló el envío del correo de bienvenida a ${correo}.`);
                    }
                }
            }
        }

        if (!carritoDesdeDB || !Array.isArray(carritoDesdeDB) || carritoDesdeDB.length === 0) {
            console.log("DEBUG ERROR: Carrito vacío o inválido después de determinar el usuario.");
            await connection.rollback();
            return res.status(400).json({
                success: false,
                mensaje: 'No se encontraron artículos en su carrito. Por favor, añada artículos antes de continuar.'
            });
        }

        // ======================================================================
        // --- INICIO DE LA CORRECCIÓN ---
        // Se elimina la variable `fecha_venta` de JS y se usa `NOW()` de MySQL.
        // ======================================================================

        // 3. Crear la FACTURA con los datos de envío
        const [facturaResult] = await connection.execute(
            `INSERT INTO factura (fk_id_usuario, fecha_venta, direccion, informacion_adicional, valor_total, metodo_pago, valor_envio, estado_pedido)
             VALUES (?, NOW(), ?, ?, ?, ?, ?, 'Pendiente')`, // Se usa NOW() directamente
            // Se quita la variable de fecha de los parámetros
            [fk_id_usuario, direccion, informacion_adicional || null, 0.00, null, 0.00]
        );
        const id_factura = facturaResult.insertId;
        console.log(`Nueva factura (ID: ${id_factura}) creada con datos de envío para usuario ID: ${fk_id_usuario}.`);
        
        // ======================================================================
        // --- FIN DE LA CORRECCIÓN ---
        // ======================================================================

        // 4. Limpiar y Repoblar el CARRITO_COMPRAS en la DB si es un usuario invitado/nuevo
        if (!req.user || esNuevoRegistro) {
            await connection.execute(`DELETE FROM carrito_compras WHERE FK_id_usuario = ?`, [fk_id_usuario]);
            console.log(`Carrito de compras existente en DB limpiado para el usuario ID: ${fk_id_usuario}`);

            for (const item of carritoDesdeDB) {
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

        await connection.commit();
        console.log("DEBUG: Transacción de DireccionEnvio completada y datos guardados en DB.");

        res.status(200).json({
            success: true,
            mensaje: 'Información de envío y factura inicial procesadas. Puedes continuar con la compra.',
            id_factura_creada: id_factura,
            fk_id_usuario_para_compra: fk_id_usuario,
            nuevo_usuario_registrado: esNuevoRegistro,
            datos_usuario_para_checkout: {
                nombre,
                cedula,
                telefono,
                correo,
                direccion,
                informacion_adicional
            },
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
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('correo')) {
            return res.status(409).json({
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