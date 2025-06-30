const pool = require('../db');
// const bcrypt = require('bcrypt'); // No necesario aquí, como bien señalas

async function DireccionEnvio(req, res) {
    let connection; // Declarar la conexión fuera del try para que sea accesible en finally
    try {
        console.log("=== DEBUG BACKEND - Función DireccionEnvio (Nueva Lógica) ===");
        console.log("DEBUG: req.user (desde token, si existe):", req.user); // Información si el usuario está autenticado

        const {
            nombre,
            cedula,
            telefono,
            correo,
            direccion,
            informacion_adicional // Sigue siendo opcional
        } = req.body;

        // --- DEBUG 1: Datos recibidos en el cuerpo de la solicitud (req.body) ---
        console.log("DEBUG 1: Datos recibidos en req.body:", JSON.stringify(req.body, null, 2));

        // 1. Validación de campos obligatorios
        if (!nombre || !cedula || !telefono || !correo || !direccion) {
            console.log("DEBUG ERROR: Campos obligatorios faltantes en req.body.");
            return res.status(400).json({
                success: false,
                mensaje: 'Los campos nombre, cédula, teléfono, correo y dirección son obligatorios.'
            });
        }

        connection = await pool.getConnection(); // Obtener una conexión del pool
        await connection.beginTransaction(); // Iniciar una transacción

        let fk_id_usuario;
        let userWasRegisteredInDB = false;
        let userDataToReturn = {};

        // 1. Manejo del Usuario (Autenticado o Invitado)
        if (req.user && req.user.id_usuario) {
            // --- Usuario AUTENTICADO ---
            console.log("Usuario AUTENTICADO. ID:", req.user.id_usuario);
            fk_id_usuario = req.user.id_usuario;
            userWasRegisteredInDB = true;

            // Obtener los datos actuales del usuario desde la DB para validación/actualización
            const [userCheck] = await connection.execute(
                `SELECT nombre, cedula, telefono, correo FROM usuario WHERE id_usuario = ?`,
                [fk_id_usuario]
            );

            if (userCheck.length === 0) {
                console.error("ERROR: Usuario autenticado no encontrado en la base de datos con ID:", fk_id_usuario);
                await connection.rollback(); // Deshacer la transacción
                return res.status(401).json({
                    success: false,
                    mensaje: 'Usuario autenticado no encontrado en la base de datos.'
                });
            }

            const currentUser = userCheck[0];
            let updateFields = [];
            let updateValues = [];

            // Actualizar datos del usuario si son diferentes
            if (nombre !== currentUser.nombre) { updateFields.push('nombre = ?'); updateValues.push(nombre); }
            if (parseInt(cedula, 10) !== currentUser.cedula) { updateFields.push('cedula = ?'); updateValues.push(cedula); }
            if (telefono !== currentUser.telefono) { updateFields.push('telefono = ?'); updateValues.push(telefono); }
            if (correo !== currentUser.correo) { // Validar que el correo coincida con el del token
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

            userDataToReturn = {
                nombre: nombre,
                cedula: cedula,
                telefono: telefono,
                correo: correo
            };

        } else {
            // --- Usuario NO AUTENTICADO (Invitado) ---
            console.log("Usuario NO AUTENTICADO. Intentando encontrar o registrar.");

            // Buscar si el correo electrónico ya existe en la tabla USUARIO
            const [existingUserByEmail] = await connection.execute(
                `SELECT id_usuario, nombre, cedula, telefono, correo FROM usuario WHERE correo = ?`,
                [correo]
            );

            if (existingUserByEmail.length > 0) {
                // El correo existe, usar su ID y actualizar datos si es necesario
                fk_id_usuario = existingUserByEmail[0].id_usuario;
                userWasRegisteredInDB = true;
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

                userDataToReturn = {
                    nombre: nombre,
                    cedula: cedula,
                    telefono: telefono,
                    correo: correo
                };

            } else {
                // El correo NO existe, REGISTRAR un nuevo usuario
                console.log("Correo NO registrado en DB. Registrando nuevo usuario.");
                userWasRegisteredInDB = false; // Es un nuevo registro

                const [result] = await connection.execute(
                    `INSERT INTO usuario (nombre, cedula, telefono, correo, tipo_usuario, estado_usuario, fecha_registro)
                     VALUES (?, ?, ?, ?, 'cliente', 'activo', NOW())`,
                    [nombre, cedula, telefono, correo]
                );
                fk_id_usuario = result.insertId;
                console.log(`Nuevo usuario registrado con ID: ${fk_id_usuario}`);

                userDataToReturn = {
                    nombre: nombre,
                    cedula: cedula,
                    telefono: telefono,
                    correo: correo
                };
            }
        }

        // 2. Insertar la Dirección de Envío en la tabla 'factura'
        // Generar un ID de factura temporal (puedes tener una secuencia o autoincremento en DB)
        // Si `id_factura` es AUTO_INCREMENT, no necesitas generarlo aquí.
        // Si necesitas un formato específico (ej. 'INV-001'), deberás implementarlo.
        // Por ahora, asumiré que `id_factura` es AUTO_INCREMENT o se gestiona en la DB.
        const fecha_venta = new Date(); // Fecha actual

        const [facturaResult] = await connection.execute(
            `INSERT INTO factura (fk_id_usuario, fecha_venta, direccion, informacion_adicional, estado_factura)
             VALUES (?, ?, ?, ?, 'Pendiente')`, // Asume un estado inicial 'Pendiente'
            [fk_id_usuario, fecha_venta, direccion, informacion_adicional || null]
        );
        const id_factura = facturaResult.insertId;
        console.log(`Dirección de envío guardada en nueva factura con ID: ${id_factura} para usuario ID: ${fk_id_usuario}`);

        // 3. Almacenar el ID de la factura en la sesión (esto SÍ es necesario para el siguiente paso)
        // Para que FinalizarCompraYRegistro sepa qué factura actualizar.
        req.session.checkout = req.session.checkout || {}; // Asegurarse de que exista
        req.session.checkout.id_factura_temp = id_factura;
        req.session.checkout.fk_id_usuario_temp = fk_id_usuario; // También guardar el ID de usuario para consistencia
        console.log(`DEBUG: ID de factura (${id_factura}) y usuario ID (${fk_id_usuario}) guardados en sesión para la próxima etapa.`);


        await connection.commit(); // Confirmar la transacción
        console.log("DEBUG: Transacción de DireccionEnvio completada y datos guardados en DB.");

        // --- IMPORTANTE: Guardar la sesión explícitamente ---
        req.session.save((err) => {
            if (err) {
                console.error("DEBUG ERROR: Error al guardar la sesión después de DireccionEnvio:", err);
                return res.status(500).json({ success: false, mensaje: 'Error interno del servidor al guardar la información de la sesión.' });
            }
            console.log("DEBUG: Sesión guardada exitosamente después de DireccionEnvio.");

            // Respuesta final
            res.status(200).json({
                success: true,
                mensaje: 'Información de envío procesada y registrada. Puedes continuar con la compra.',
                usuario_existente_en_db: userWasRegisteredInDB,
                datos_usuario: userDataToReturn,
                id_factura: id_factura // Retornar el ID de la factura generada
            });
        });

    } catch (error) {
        console.error('Error en la función DireccionEnvio:', error);
        if (connection) {
            try {
                await connection.rollback(); // Deshacer la transacción en caso de error
                console.log("DEBUG: Transacción de DireccionEnvio revertida debido a un error.");
            } catch (rollbackError) {
                console.error("DEBUG ERROR: Error al hacer rollback:", rollbackError);
            }
        }
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al procesar la dirección de envío.'
        });
    } finally {
        if (connection) {
            connection.release(); // Liberar la conexión de vuelta al pool
            console.log("DEBUG: Conexión a la DB liberada.");
        }
    }
}

module.exports = {
    DireccionEnvio
};