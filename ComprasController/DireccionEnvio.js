const pool = require('../db');
// const bcrypt = require('bcrypt'); // Ya no es necesario aquí si no manejamos contraseñas

async function DireccionEnvio(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Función DireccionEnvio (Actualizada) ===");
        console.log("req.user (desde token):", req.user); // Información si el usuario está autenticado

        const {
            nombre,
            cedula,
            telefono,
            correo,
            direccion,
            informacion_adicional // Sigue siendo opcional según tu esquema DB
        } = req.body;

        // 1. Validación de campos obligatorios (ahora más estricta)
        if (!nombre || !cedula || !telefono || !correo || !direccion) {
            return res.status(400).json({
                success: false,
                mensaje: 'Los campos nombre, cédula, teléfono, correo y dirección son obligatorios.'
            });
        }

        let fk_id_usuario = null;
        let userDataToReturn = {};
        let userWasRegisteredInDB = false; // Indica si el usuario ya existe en la tabla USUARIO

        // Verificar si el usuario está autenticado a través del token
        if (req.user && req.user.id_usuario) {
            // --- Usuario AUTENTICADO ---
            console.log("Usuario AUTENTICADO. ID:", req.user.id_usuario);
            fk_id_usuario = req.user.id_usuario;
            userWasRegisteredInDB = true;

            // Obtener los datos actuales del usuario
            const [userCheck] = await pool.execute(
                `SELECT nombre, cedula, telefono, correo FROM USUARIO WHERE id_usuario = ?`,
                [fk_id_usuario]
            );

            if (userCheck.length === 0) {
                // Esto no debería ocurrir si el token es válido
                return res.status(401).json({
                    success: false,
                    mensaje: 'Usuario autenticado no encontrado en la base de datos.'
                });
            }

            const currentUser = userCheck[0];
            let updateFields = [];
            let updateValues = [];

            // Actualizar datos del usuario si son diferentes de los proporcionados
            // Ojo: el correo no se actualiza por seguridad aquí. Si cambia, implica nuevo registro o proceso de cambio de email.
            if (nombre !== currentUser.nombre) {
                updateFields.push('nombre = ?');
                updateValues.push(nombre);
            }
            if (parseInt(cedula, 10) !== currentUser.cedula) { // Convertir a número para comparación
                updateFields.push('cedula = ?');
                updateValues.push(cedula);
            }
            if (telefono !== currentUser.telefono) {
                updateFields.push('telefono = ?');
                updateValues.push(telefono);
            }
            // El correo no se actualiza aquí, solo se valida que el proporcionado sea el del token.
            if (correo !== currentUser.correo) {
                console.warn(`[Seguridad] Correo proporcionado (${correo}) no coincide con el del token (${currentUser.correo}). Ignorando cambio de correo.`);
                // Podrías devolver un error 403 o 400 si esto es un intento de spoofing
                return res.status(403).json({
                    success: false,
                    mensaje: 'El correo proporcionado no coincide con el de su cuenta autenticada.'
                });
            }


            if (updateFields.length > 0) {
                const updateQuery = `UPDATE USUARIO SET ${updateFields.join(', ')} WHERE id_usuario = ?`;
                updateValues.push(fk_id_usuario);
                await pool.execute(updateQuery, updateValues);
                console.log(`Usuario ID ${fk_id_usuario} actualizado con nuevos datos.`);
            }

            // Obtener la dirección de la última compra si existe
            const [lastPurchase] = await pool.execute(
                `SELECT direccion, informacion_adicional FROM FACTURA WHERE fk_id_usuario = ? ORDER BY fecha_venta DESC LIMIT 1`,
                [fk_id_usuario]
            );

            // Rellenar userDataToReturn con la información actualizada del usuario + última dirección
            userDataToReturn = {
                nombre: nombre,
                cedula: cedula,
                telefono: telefono,
                correo: correo,
                direccion_anterior: lastPurchase.length > 0 ? lastPurchase[0].direccion : null,
                informacion_adicional_anterior: lastPurchase.length > 0 ? lastPurchase[0].informacion_adicional : null
            };

            // Almacenar la información de envío actual temporalmente en la sesión
            req.session.checkout = req.session.checkout || {};
            req.session.checkout[fk_id_usuario] = {
                direccion: direccion,
                informacion_adicional: informacion_adicional || null
            };
            console.log("Dirección de envío temporalmente guardada en sesión para usuario autenticado.");

        } else {
            // --- Usuario NO AUTENTICADO ---
            console.log("Usuario NO AUTENTICADO.");

            // Verificar si el correo electrónico ya existe en la tabla USUARIO
            const [existingUserByEmail] = await pool.execute(
                `SELECT id_usuario, nombre, cedula, telefono, correo FROM USUARIO WHERE correo = ?`,
                [correo]
            );

            if (existingUserByEmail.length > 0) {
                // El correo electrónico existe, el usuario no está autenticado.
                // Actualizamos sus datos y obtenemos su última dirección.
                fk_id_usuario = existingUserByEmail[0].id_usuario;
                userWasRegisteredInDB = true;

                console.log("Correo ya registrado, usuario no autenticado. ID:", fk_id_usuario);

                const existingUser = existingUserByEmail[0];
                let updateFields = [];
                let updateValues = [];

                // Actualizar datos del usuario si son diferentes
                if (nombre !== existingUser.nombre) {
                    updateFields.push('nombre = ?');
                    updateValues.push(nombre);
                }
                if (parseInt(cedula, 10) !== existingUser.cedula) { // Convertir a número para comparación
                    updateFields.push('cedula = ?');
                    updateValues.push(cedula);
                }
                if (telefono !== existingUser.telefono) {
                    updateFields.push('telefono = ?');
                    updateValues.push(telefono);
                }

                if (updateFields.length > 0) {
                    const updateQuery = `UPDATE USUARIO SET ${updateFields.join(', ')} WHERE id_usuario = ?`;
                    updateValues.push(fk_id_usuario);
                    await pool.execute(updateQuery, updateValues);
                    console.log(`Datos de usuario existente (ID: ${fk_id_usuario}) actualizados.`);
                }

                // Obtener la dirección de la última compra para este usuario
                const [lastPurchase] = await pool.execute(
                    `SELECT direccion, informacion_adicional FROM FACTURA WHERE fk_id_usuario = ? ORDER BY fecha_venta DESC LIMIT 1`,
                    [fk_id_usuario]
                );

                userDataToReturn = {
                    nombre: nombre,
                    cedula: cedula,
                    telefono: telefono,
                    correo: correo,
                    direccion_anterior: lastPurchase.length > 0 ? lastPurchase[0].direccion : null,
                    informacion_adicional_anterior: lastPurchase.length > 0 ? lastPurchase[0].informacion_adicional : null
                };

                // Almacenar la información de envío actual temporalmente en la sesión
                req.session.checkout = req.session.checkout || {};
                req.session.checkout[fk_id_usuario] = { // Usar el id_usuario encontrado
                    direccion: direccion,
                    informacion_adicional: informacion_adicional || null
                };
                console.log("Dirección de envío temporalmente guardada en sesión para usuario existente no autenticado.");

            } else {
                // El correo NO existe, el usuario no está autenticado y no se le pide contraseña.
                // En este caso, NO se registra en la DB. Simplemente se le informa.
                console.log("Correo NO registrado. No se puede proceder sin registro o inicio de sesión.");
                return res.status(404).json({
                    success: false,
                    mensaje: 'El correo electrónico no está registrado. Por favor, regístrese o inicie sesión para continuar con su compra.'
                });
            }
        }

        // Respuesta final
        res.status(200).json({
            success: true,
            mensaje: 'Información de envío procesada exitosamente.',
            usuario_existente_en_db: userWasRegisteredInDB, // Indica si el usuario ya estaba en la DB
            datos_usuario: userDataToReturn,
            direccion_temporal_guardada: {
                direccion: direccion,
                informacion_adicional: informacion_adicional || null
            }
        });

    } catch (error) {
        console.error('Error en la función DireccionEnvio:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al procesar la dirección de envío.'
        });
    }
}

module.exports = {
    DireccionEnvio
};