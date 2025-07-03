require("dotenv").config();
const fetch = require('node-fetch');

const db = require("../db");

async function obtenerProductos() {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.referencia,
                p.nombre,
                p.precio_unidad,
                p.stock,
                p.marca,
                c.nombre_categoria,
                s.nombre_subcategoria
            FROM producto p
            INNER JOIN categoria c ON p.FK_id_categoria = c.id_categoria
            INNER JOIN subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
            WHERE p.stock > 0
        `);
        return rows;
    } catch (error) {
        console.error("Error al obtener productos:", error);
        throw error;
    }
}

async function infoChat(req, res) {
    const { message } = req.body;

    try {
        const inventario = await obtenerProductos();
        const respuesta = await getChatResponse(message, inventario);
        res.json({ respuesta });
    } catch (err) {
        console.error("Error general:", err);
        res.status(500).json({ error: "Error al procesar la solicitud" });
    }
}

// Función para obtener modelos disponibles
async function obtenerModelosDisponibles() {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            console.error("❌ Error al obtener modelos:", response.status);
            return null;
        }

        const data = await response.json();
        const modelos = data.data.map(model => model.id);
        console.log("✅ Modelos disponibles encontrados:", modelos.slice(0, 10)); // Mostrar solo los primeros 10
        return modelos;
    } catch (error) {
        console.error("❌ Error al consultar modelos:", error);
        return null;
    }
}

// Función para seleccionar el mejor modelo disponible
async function seleccionarModelo() {
    const modelos = await obtenerModelosDisponibles();
    
    if (!modelos) {
        console.log("⚠️ No se pudieron obtener modelos, usando modelo por defecto");
        return "gpt-3.5-turbo"; // Fallback básico
    }

    // Lista de modelos preferidos en orden de preferencia
    const modelosPreferidos = [
        "openai/gpt-4o-mini",
        "openai/gpt-4o",
        "openai/gpt-3.5-turbo",
        "anthropic/claude-3-haiku",
        "google/gemini-pro",
        "meta-llama/llama-3.1-8b-instruct:free",
        "microsoft/wizardlm-2-8x22b:free",
        "google/gemma-2-9b-it:free",
        "nousresearch/hermes-3-llama-3.1-405b:free",
        "qwen/qwen-2-7b-instruct:free"
    ];

    // Buscar el primer modelo disponible
    for (const modelo of modelosPreferidos) {
        if (modelos.includes(modelo)) {
            console.log(`✅ Usando modelo: ${modelo}`);
            return modelo;
        }
    }

    // Si no encuentra ninguno preferido, usar el primer modelo disponible
    const primerModelo = modelos[0];
    console.log(`⚠️ Usando primer modelo disponible: ${primerModelo}`);
    return primerModelo;
}

async function getChatResponse(message, inventario) {
    const infoEmpresa = `El aplicativo de Accesorios Apolo será una herramienta integral pensada para modernizar y agilizar 
la gestión del negocio. Permitirá organizar y controlar de forma eficiente el inventario, registrar 
las ventas de manera detallada, administrar la base de datos de clientes y mostrar un catálogo 
digital atractivo. Todo esto estará centralizado en un panel administrativo intuitivo que facilitará 
el análisis de datos y la toma de decisiones. Con este aplicativo, Accesorios Apolo podrá optimizar 
sus procesos, ofrecer una mejor experiencia a sus clientes y fortalecer su presencia en el entorno digital.

---
## Información General
* **Nombre de la Empresa:** Accesorios Apolo
* **Tipo de Negocio:** Venta de accesorios para motocicletas.
* **Historia:** Accesorios Apolo nació de la pasión por las motocicletas y la necesidad de ofrecer productos de calidad que garanticen la seguridad, comodidad y estilo de los motociclistas. Desde nuestros inicios, nos hemos enfocado en seleccionar un catálogo diverso y de alta gama para satisfacer las necesidades de cada cliente, construyendo una reputación de confianza y excelencia en el mercado local.
* **Fundador y Dueño Actual:** Herney Restrepo Ortiz.
* **Público Objetivo:** Motociclistas y entusiastas de las motos que buscan accesorios de alta calidad, innovadores y funcionales para mejorar su experiencia de conducción, seguridad y estética de sus vehículos.

---
## Ubicación y Contacto
* **Ubicación:** Montenegro, Quindío.
* **Dirección:** Cra. 6 #21-28.
* **Horarios de Atención:**
    * Lunes a sábado: 9:00 AM - 07:00 PM.
    * Domingos y festivos: No hay atención.
* **Información de Contacto:**
    * Teléfono: 323 326 4572.
    * Correo electrónico: accesoriosapolom@gmail.com
    * Instagram: @accesoriosapolom
    * Facebook: Accesories Apolo  

---
## Filosofía y Valores
* **Misión:**
    En nuestra empresa de accesorios para motos, nos comprometemos a proporcionar productos de alta calidad 
    que potencien la experiencia de los motociclistas, garantizando seguridad, comodidad y estilo. Nos esforzamos 
    por ofrecer una amplia gama de accesorios innovadores y funcionales, respaldados por un compromiso inquebrantable 
    con la excelencia en el diseño, la fabricación y la satisfacción del cliente.  
    Nuestro propósito es no solo equipar a los motociclistas con accesorios superiores, sino también promover una 
    cultura de seguridad en la conducción, creando así una comunidad comprometida con la pasión por las motos y el 
    respeto por la carretera.
* **Visión:**
    Nos visualizamos como líderes en la industria de accesorios para motos, siendo reconocidos a nivel nacional 
    e internacional por nuestra innovación, calidad y compromiso con la seguridad. Buscamos expandir continuamente 
    nuestra gama de productos, utilizando tecnologías avanzadas y materiales de vanguardia para brindar soluciones 
    que excedan las expectativas de nuestros clientes.

    Aspiramos a ser un referente en la comunidad motociclista, no solo por nuestros productos, sino también por nuestro 
    compromiso con la educación vial y la promoción de la seguridad en la conducción. Queremos ser la opción preferida 
    de los motociclistas, siendo su compañero de confianza en cada viaje, impulsando su pasión y protegiendo su bienestar 
    en la carretera.
* **Valores Diferenciadores:**
    * **Calidad Garantizada:** Todos nuestros productos pasan por rigurosos controles de calidad para asegurar durabilidad y rendimiento.
    * **Innovación Constante:** Estamos siempre al tanto de las últimas tendencias y tecnologías para ofrecer accesorios de vanguardia.
    * **Atención Personalizada:** Ofrecemos asesoría experta para ayudar a nuestros clientes a elegir los accesorios perfectos para sus necesidades.
    * **Compromiso con la Seguridad:** Promovemos activamente la educación vial y la importancia de equipos de seguridad adecuados.
    * **Comunidad:** Buscamos construir una comunidad sólida de motociclistas apasionados.

---
## Acerca del Aplicativo Web
* **Propósito del Aplicativo:** Modernizar y agilizar la gestión del negocio de Accesorios Apolo, permitiendo un control eficiente del inventario, registro de ventas, administración de clientes y un catálogo digital interactivo. Su objetivo es optimizar procesos, mejorar la experiencia del cliente y fortalecer la presencia digital.
* **Funcionalidades Principales:**
    * **Gestión de Inventario:** Control detallado y eficiente del stock de productos.
    * **Registro de Ventas:** Seguimiento pormenorizado de todas las transacciones.
    * **Administración de Clientes:** Base de datos de clientes para una mejor relación y personalización.
    * **Catálogo Digital:** Visualización atractiva y organizada de todos los productos disponibles.
    * **Panel Administrativo Intuitivo:** Herramienta centralizada para análisis de datos y toma de decisiones.
    * **Maletero (Carrito de Compras):** En nuestra página web, el "carrito de compras" se llama **maletero**. Puedes **agregar productos** a tu maletero desde cualquier página de producto. Una vez que hayas añadido productos, dirígete al icono del **maletero** ubicado en la **parte superior derecha** de la pantalla. Dentro del maletero, podrás **ajustar la cantidad** de cada producto, eliminar artículos y revisar tu pedido antes de finalizar la compra.
    * **Personalización de Calcomanías:** Si deseas personalizar tus propias calcomanías, ve al apartado de **"Calcomanías"** en la navegación. Dentro de esta sección, encontrarás una opción llamada **"Sube tu calcomanía"**. Aquí podrás **subir tus propias imágenes**, **recortarlas** a tu gusto, **asignarles un nombre** único y **personalizar el tamaño** para que se ajusten perfectamente a tus necesidades.
* **Beneficios para el Usuario:**
    * Acceso fácil y rápido al catálogo de productos.
    * Información detallada sobre cada accesorio (referencia, nombre, precio, stock, marca, categoría, subcategoría).
    * Proceso de compra simplificado y personalización de productos.
    * Historial de pedidos y gestión de cuenta personal.
* **Cómo Registrarse:**
    1.  En la página de inicio del aplicativo, busca la barra de navegación superior y haz clic en "**Registrarse**".
    2.  Completa el formulario con tus datos personales: nombre, teléfono, correo electrónico y contraseña.
    3.  Haz clic en "**Registrarse**" para crear tu cuenta.
    4.  Recibirás un correo electrónico con un código OTP de confirmación.
    5.  Ingresa el código OTP en el aplicativo para verificar tu cuenta.
    6.  Una vez verificado, verás un mensaje de bienvenida y podrás acceder al aplicativo.
* **Cómo Iniciar Sesión:**
    1.  En la página de inicio del aplicativo, dirígete a la barra de navegación superior
        donde encontrarás la opción "**Iniciar Sesión**".
    2.  Haz clic en "**Iniciar Sesión**" y completa el formulario con tu correo electrónico y contraseña.
    3.  Asegúrate de que los datos sean correctos y haz clic en "**Iniciar Sesión**".
    4.  Si los datos son válidos, serás redirigido al panel de control del aplicativo, donde podrás acceder a todas las funcionalidades disponibles.
* **Cómo Restablecer Contraseña (si la olvidaste):**
    1.  En la página de inicio del aplicativo, dirígete a la barra de navegación superior y haz clic en "**Iniciar Sesión**".
    2.  En la página de inicio de sesión, encontrarás un enlace que dice "**¿Olvidaste tu contraseña?**".
    3.  Haz clic en ese enlace y se te pedirá que ingreses tu correo electrónico asociado a tu cuenta.
    4.  Después de ingresar tu correo, recibirás un correo electrónico con un enlace para restablecer tu contraseña.
    5.  Haz clic en el enlace del correo y serás redirigido a una página donde podrás ingresar una nueva contraseña.
    6.  Ingresa tu nueva contraseña y confírmala.

Inventario actual:
${JSON.stringify(inventario)}`
    
    // Verificar que la API key existe
    if (!process.env.OPENROUTER_API_KEY) {
        console.error("❌ OPENROUTER_API_KEY no está configurada en las variables de entorno");
        return "Error de configuración del servicio de IA.";
    }

    // Log para debug (solo mostrar los primeros caracteres por seguridad)
    console.log("🔑 API Key encontrada:", process.env.OPENROUTER_API_KEY.substring(0, 10) + "...");

    // Seleccionar modelo disponible
    const modeloSeleccionado = await seleccionarModelo();

    const messages = [
        {
            role: "system",
            content: `Eres un asistente virtual llamado Apolito, creado exclusivamente para responder preguntas sobre Accesorios Apolo, 
incluyendo su inventario, ubicación, horarios, misión, visión, datos de contacto, y funcionamiento del aplicativo web.

Debes responder de forma clara, amigable, respetuosa y útil. Si el usuario saluda (ej. "hola", "buenos días"), respóndele también con un saludo cordial.  
Si el usuario se despide o agradece (ej. "gracias", "hasta luego"), responde con una despedida amable e invítalo a volver.  
Si el usuario pregunta por atención al cliente, muestra los medios de contacto y horarios disponibles.  
Si el usuario hace una pregunta fuera de ese contexto (por ejemplo: fútbol, clima, política, matemáticas, etc.), responde con:  
"Lo siento, solo puedo responder preguntas relacionadas con Accesorios Apolo y su aplicativo."

Aquí tienes información de referencia sobre la empresa e inventario:

${infoEmpresa}

Inventario actual:
${JSON.stringify(inventario)}`
        },
        {
            role: "user",
            content: message
        }
    ];

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://accesorios-apolo-frontend.vercel.app", // Opcional: tu dominio
                "X-Title": "AccesoriosApolo" // Opcional: nombre de tu app
            },
            body: JSON.stringify({
                model: modeloSeleccionado, // ✅ Modelo seleccionado dinámicamente
                messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        // Verificar el status de la respuesta
        if (!response.ok) {
            console.error("❌ Error HTTP:", response.status, response.statusText);
            const errorText = await response.text();
            console.error("❌ Error body:", errorText);
            return "Error al conectar con el servicio de IA.";
        }

        const data = await response.json();
        console.log("✅ Respuesta recibida:", data);

        if (data?.error) {
            console.error("❌ Error en respuesta IA:", data.error);
            return "Ocurrió un error con el servicio de IA.";
        }

        const respuestaIA = data.choices?.[0]?.message?.content?.trim();
        return respuestaIA?.length >= 5 ? respuestaIA : "No entendí tu pregunta. ¿Podrías reformularla?";
    } catch (err) {
        console.error("❌ Error general en getChatResponse:", err.message || err);
        return "Error al procesar la respuesta con IA.";
    }
}

module.exports = {
    infoChat
};