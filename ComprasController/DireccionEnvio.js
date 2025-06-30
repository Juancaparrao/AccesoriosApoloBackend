const pool = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto'); // Necesario para generar bytes aleatorios


function generarContrasenaSegura() {
    // Genera 8 bytes aleatorios y los convierte a una cadena hexadecimal (16 caracteres)
    return crypto.randomBytes(8).toString('hex');
}

async function DireccionEnvio(req, res) {
    let connection;
    try {
        console.log("=== DEBUG BACKEND - Función DireccionEnvio (Ahora sí crea la Factura, no Detalle_Factura) ===");
        console.log("DEBUG: req.user (desde token, si existe):", req.user);

        const {
            nombre,
            cedula,
            telefono,
            correo,
            direccion,
            informacion_adicional,
            carrito // Datos del carrito desde el frontend
        } = req.body;

        // --- DEBUG 1: Datos recibidos en el cuerpo de la solicitud (req.body) ---
        console.log("DEBUG 1: Datos recibidos en req.body:", JSON.stringify(req.body, null, 2));

        // 1. Validación de campos obligatorios
        if (!nombre || !cedula || !telefono || !correo || !direccion || !carrito || !Array.isArray(carrito) || carrito.length === 0) {
            console.log("DEBUG ERROR: Campos obligatorios faltantes o carrito vacío en req.body.");
            return res.status(400).json({
                success: false,
                mensaje: 'Los campos nombre, cédula, teléfono, correo, dirección y un carrito no vacío son obligatorios.'
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        let fk_id_usuario;
        let esNuevoRegistro = false; // Flag para saber si se registró un nuevo usuario
        let contrasenaGenerada = null; // Para almacenar la contraseña generada si aplica

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
                console.warn(`[Seguridad] Correo proporcionado (${correo}) no coincide con el del token (${currentUser.correo}).`);
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

        } else {
            // --- Usuario NO AUTENTICADO (Invitado) ---
            console.log("Usuario NO AUTENTICADO. Intentando encontrar o registrar.");

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

                contrasenaGenerada = generarContrasenaSegura(); // Usar la función creada aquí
                const hashedPassword = await bcrypt.hash(contrasenaGenerada, 10); // Hashear para guardar

                const [result] = await connection.execute(
                    `INSERT INTO USUARIO (nombre, cedula, telefono, correo, contrasena, estado) VALUES (?, ?, ?, ?, ?, ?)`,
                    [nombre, cedula, telefono, correo, hashedPassword, true] // Estado true por defecto
                );
                fk_id_usuario = result.insertId;

                // Asignar el rol 'cliente' al nuevo usuario
                const [clienteRole] = await connection.execute(
                    `SELECT id_rol FROM ROL WHERE nombre = 'cliente'`
                );
                if (clienteRole.length > 0) {
                    await connection.execute(
                        `INSERT INTO USUARIO_ROL (fk_id_usuario, id_rol) VALUES (?, ?)`,
                        [fk_id_usuario, clienteRole[0].id_rol]
                    );
                    console.log(`Rol 'cliente' asignado al nuevo usuario ID: ${fk_id_usuario}`);
                } else {
                    console.warn("Advertencia: No se encontró el rol 'cliente' en la base de datos.");
                }
                console.log(`Nuevo usuario registrado automáticamente con ID: ${fk_id_usuario}`);
            }
        }

        // 3. Crear la FACTURA con los datos de envío
        // Establecemos un valor_total y metodo_pago iniciales a NULL/0.00,
        // ya que se actualizarán en el paso FinalizarCompraYRegistro
        const fecha_venta = new Date(); // Fecha actual
        const [facturaResult] = await connection.execute(
            `INSERT INTO FACTURA (fk_id_usuario, fecha_venta, direccion, informacion_adicional, estado_factura, valor_total, metodo_pago, valor_envio)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [fk_id_usuario, fecha_venta, direccion, informacion_adicional || null, 'Pendiente', 0.00, null, 0.00]
        );
        const id_factura = facturaResult.insertId;
        console.log(`Nueva factura (ID: ${id_factura}) creada con datos de envío para usuario ID: ${fk_id_usuario}.`);


        // 4. Limpiar y Repoblar el CARRITO_COMPRAS en la DB
        // Eliminar cualquier artículo existente para este usuario en el carrito de la DB
        await connection.execute(
            `DELETE FROM CARRITO_COMPRAS WHERE FK_id_usuario = ?`,
            [fk_id_usuario]
        );
        console.log(`Carrito de compras existente en DB limpiado para el usuario ID: ${fk_id_usuario}`);

        // Insertar los nuevos artículos del carrito enviados desde el frontend
        if (carrito && Array.isArray(carrito) && carrito.length > 0) {
            console.log(`DEBUG: Insertando ${carrito.length} ítems del carrito en CARRITO_COMPRAS.`);
            for (const item of carrito) {
                // Validación básica de ítems del carrito
                if (!item.cantidad || item.cantidad <= 0) {
                    console.warn("DEBUG ADVERTENCIA: Ítem de carrito con cantidad inválida:", item);
                    continue;
                }
                // Asegúrate de que los IDs existan y sean válidos para tu DB
                const fk_referencia_producto = item.tipo === 'producto' ? item.id_producto : null;
                const fk_id_calcomania = item.tipo === 'calcomania' ? item.id_calcomania : null;
                const tamano_calcomania = item.tipo === 'calcomania' ? item.tamano : null;

                if (!fk_referencia_producto && !fk_id_calcomania) {
                    console.warn("DEBUG ADVERTENCIA: Ítem de carrito sin FK_referencia_producto ni FK_id_calcomania:", item);
                    continue;
                }

                await connection.execute(
                    `INSERT INTO CARRITO_COMPRAS (FK_id_usuario, FK_referencia_producto, FK_id_calcomania, cantidad, tamano)
                     VALUES (?, ?, ?, ?, ?)`,
                    [fk_id_usuario, fk_referencia_producto, fk_id_calcomania, item.cantidad, tamano_calcomania]
                );
                console.log(`DEBUG: Ítem añadido a CARRITO_COMPRAS para usuario ${fk_id_usuario}: `, item);
            }
        } else {
            console.warn("ADVERTENCIA: Carrito vacío enviado, no se insertarán ítems en CARRITO_COMPRAS.");
        }


        // 5. Almacenar información relevante en la sesión para el siguiente paso (FinalizarCompraYRegistro)
        req.session.checkout = req.session.checkout || {};
        req.session.checkout.id_factura_temp = id_factura; // Guardamos el ID de la factura creada
        req.session.checkout.fk_id_usuario_para_compra = fk_id_usuario;
        req.session.checkout.es_nuevo_registro = esNuevoRegistro;
        if (esNuevoRegistro) {
            req.session.checkout.contrasena_generada = contrasenaGenerada;
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
                // Si es un nuevo usuario, podrías querer retornar la contraseña aquí para que el frontend la muestre/envíe
                ...(esNuevoRegistro && { contrasena_generada: contrasenaGenerada })
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