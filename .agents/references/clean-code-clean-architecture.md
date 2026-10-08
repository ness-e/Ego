# **Compendio Técnico de Clean Code y Clean Architecture para la Gobernanza de Inteligencia Artificial en Rust, Python y TypeScript**

> **Sello de validación Ego — 2026-09-11.** Verificado contra fuentes oficiales: *Clean Code* (Martin, 2008; 2.ª ed. 2025), *Clean Architecture* (Martin, 2017), blog.cleancoder.com, resúmenes canónicos (wojteklu/cedrickchee/j-thepac). Correcciones aplicadas al importar: fórmulas Ca/Ce/I/A/D restauradas (venían como imágenes base64 rotas), typos (`Aisle` → `Aislamiento`, `strictly` → `estrictamente`, `Inmunidad a 'any'` → `Prohibición total de 'any'`, coordenadas `A ≈ 01/11` → `0/1`), escapes de exportación (`\_`, `\#`, `\-`, `\<`…) normalizados. Los límites `≤20 líneas / ≤3 args` son **convención operativa Ego** (el libro exige "small" y "≤3 args"; el número 20 es heurística de esta guía, no cita literal). Ver **Apéndice V** para el mapa de adaptación al repo real.

El desarrollo de software sostenible se fundamenta en la contención sistemática de la entropía del código y en la preservación de la flexibilidad arquitectónica a lo largo del ciclo de vida del sistema1. Cuando los modelos de lenguaje de gran tamaño (LLM) y los agentes de inteligencia artificial generan código sin restricciones explícitas, tienden de manera natural a elegir la vía de menor resistencia local2. Esta tendencia deriva en acoplamientos difusos, mezcla indeseada de niveles de abstracción, contaminación de la lógica de negocio con detalles de infraestructura y una rápida acumulación de olores de código (*code smells*)2.  
Este informe proporciona un marco normativo completo que integra los principios, prácticas, patrones, métricas y reglas de *Clean Code* y *Clean Architecture*, adaptados idiomáticamente a **Rust**, **Python** y **TypeScript**. Diseñado para servir tanto de guía de ingeniería como de especificación técnica inyectable en agentes de inteligencia artificial, este documento garantiza la generación de código mantenible, testeable, seguro y desacoplado.

## **1. Fundamentos Teóricos y Filosofía del Desarrollo Limpio**

El costo total de un sistema de software no se mide por el esfuerzo requerido para su construcción inicial, sino por el costo acumulado durante su fase de mantenimiento y evolución1. La falta de rigor arquitectónico provoca que la carga de corregir errores y adaptar código rígido supere con rapidez la capacidad de entregar valor de negocio1. La arquitectura limpia establece un diseño modular que minimiza el costo total de propiedad del software mientras maximiza la productividad del equipo de desarrollo1.

### **Axiomas Clave del Software Sostenible**

* **La Regla del Boy Scout**: Todo desarrollador o agente de inteligencia artificial que intervenga un archivo tiene la obligación de dejar el código en un estado más limpio y estructurado del que tenía al abrirlo5.  
* **Ley de LeBlanc**: Posponer la refactorización y la limpieza de código equivale a no limpiar nunca (*Later equals never*). Las soluciones temporales no corregidas de inmediato se consolidan como deuda técnica permanente.  
* **Simplicidad y No Redundancia (KISS & DRY)**: La simplicidad es la capacidad de maximizar la cantidad de trabajo no realizado5. Toda entidad de conocimiento o regla de negocio debe poseer una única representación inequívoca dentro del sistema.  
* **Primacía del Dominio sobre la Infraestructura**: El código debe expresar de forma primaria las reglas del negocio. Los marcos de trabajo (*frameworks*), las bases de datos y las interfaces de usuario son mecanismos secundarios e intercambiables3.  
* **Hacer que los Estados Inválidos sean Irrepresentables**: El diseño de tipos debe impedir gramaticalmente la construcción de estados inmateriales o contradictorios en tiempo de compilación o análisis estático9.

| Dimensión de Análisis | Arquitectura Ad-Hoc / Legacy | Clean Architecture Poli-Lenguaje | Impacto en el Ciclo de Vida |
| :---- | :---- | :---- | :---- |
| **Curva de Costo Operativo** | Crecimiento exponencial por acumulación de deuda técnica1. | Costo lineal y acotado a lo largo del tiempo1. | Garantiza la viabilidad económica del proyecto1. |
| **Acoplamiento de Entorno** | Lógica de negocio soldada al marco de trabajo y a la base de datos3. | Negocio totalmente aislado de herramientas e infraestructura3. | Permite actualizar bibliotecas y marcos sin reescribir reglas de negocio11. |
| **Facilidad de Pruebas** | Pruebas lentas que requieren bases de datos y servidores activos8. | Pruebas unitarias ultrarrápidas sobre el dominio en memoria8. | Facilita la adopción de Integración Continua (CI/CD)3. |
| **Velocidad de Modificación** | Alta fragilidad; pequeños cambios generan fallos en cadena. | Modificaciones quirúrgicas con bajo radio de impacto2. | Eleva la frecuencia de entrega de valor al mercado1. |

## **2. Micro-Arquitectura y Clean Code: Estándares Poli-Lenguaje**

La legibilidad del código es la métrica principal para evaluar la calidad a nivel de instrucción. Un código limpio debe leerse de forma fluida, expresando claramente la intención sin requerir que el lector descifre mecánicas internas complejas12.

### **2.1. Nomenclatura Estructurada y Convenciones Idiomáticas**

Los nombres de variables, funciones y clases deben ser autoexplicativos, eliminando la necesidad de comentarios aclaratorios3. Se prohíbe el uso de Notación Húngara o la inclusión de tipos en los nombres (como strName o iCounter)5. Los nombres deben ser pronunciables, localizables mediante búsqueda de texto y alineados con el lenguaje ubicuo del dominio5.

* **Rust**: snake_case para variables, funciones, módulos y métodos; PascalCase para *structs*, *enums*, *traits* y *types*; SCREAMING_SNAKE_CASE para constantes y static16.  
* **Python**: snake_case para variables, funciones, métodos y módulos; PascalCase para clases y excepciones; SCREAMING_SNAKE_CASE para constantes a nivel de módulo18.  
* **TypeScript**: camelCase para variables, funciones, métodos y propiedades; PascalCase para clases, interfaces, tipos e *enums*; SCREAMING_SNAKE_CASE para constantes globales o exportadas13.

### **2.2. Diseño de Funciones y Niveles de Abstracción (SLAP)**

Las funciones deben ser de tamaño reducido y cumplir estrictamente una sola responsabilidad (SRP a nivel de función)3. Deben operar en un único nivel de abstracción (SLAP - *Single Level of Abstraction Principle*)13. Mezclar operaciones de alto nivel (como la orquestación de un proceso de negocio) con detalles de bajo nivel (como el formateo de cadenas o llamadas a sockets) dentro del mismo cuerpo de función está prohibido13.  
La firma de las funciones debe minimizar el número de argumentos5. El número ideal de parámetros es cero (niládico), seguido de uno (monádico) o dos (diádico)19. Las funciones con tres parámetros (triádicas) deben justificarse exhaustivamente, mientras que las que requieren cuatro o más parámetros deben consolidarse pasando un objeto de configuración inmutable o un patrón *Builder*19. Se prohíbe el uso de argumentos de tipo bandera (*flag arguments*); su presencia demuestra que la función realiza más de una tarea y debe dividirse en métodos independientes.

### **2.3. Manejo Limpio de Errores: Excepciones vs. Result/Either**

El tratamiento de errores debe ser explícito, predecible y no debe oscurecer la lógica principal del dominio.

* **Rust**: Prohibido el uso de unwrap() o expect() en código de producción, salvo invariantes matemáticos imposibles de fallar debidamente documentados9. Se debe utilizar el tipo Result<T, E> y propagar errores mediante el operador ?9. Los errores del dominio deben representarse mediante enums fuertemente tipados utilizando la caja thiserror en librerías o anyhow para binarios de aplicación9.  
* **Python**: Se deben utilizar excepciones explícitas y personalizadas que hereden de DomainException20. Se prohíbe el uso de bloques except Exception: pasivos (*silent catch*) o except: vacíos9. Las excepciones deben capturarse únicamente en el nivel adecuado para traducirlas a respuestas de infraestructura o DTOs.  
* **TypeScript**: Las funciones complejas de dominio deben preferir el retorno de tipos unión discriminados o un patrón Result<T, E> explícito en lugar de lanzar excepciones no controladas10. Si se emplean excepciones, deben ser clases personalizadas que extiendan de Error y ser capturadas en los adaptadores de interfaz.

### **2.4. Uso Riguroso de Comentarios y Documentación**

Un comentario es a menudo la manifestación del fracaso en expresar una idea directamente a través del código. Los comentarios permitidos se limitan a la aclaración de decisiones de diseño no evidentes, advertencias sobre consecuencias de rendimiento, o documentación formal de API pública. Se deben eliminar sistemáticamente los comentarios redundantes, el código comentado y los comentarios de cierre de bloques.

### **2.5. Catálogo Formal de Olores de Código (Code Smells) y Anti-patrones**

| Código ID | Smell / Anti-patrón | Manifestación en el Código | Regla de Corrección | Efecto / Impacto Técnico |
| :---- | :---- | :---- | :---- | :---- |
| **G1** | **Rigidez (*Rigidity*)** | Modificar un requisito provoca una cascada de cambios en múltiples módulos. | Desacoplar módulos usando la Inversión de Dependencias (DIP) e interfaces/traits4. | Reduces el tiempo y costo de mantenimiento preventivo y correctivo1. |
| **G2** | **Fragilidad (*Fragility*)** | Un cambio en un punto del sistema rompe partes no relacionadas sin aviso previo. | Encapsular conceptos volátiles y eliminar dependencias implícitas. | Otorga estabilidad al sistema y previene regresiones en producción. |
| **G3** | **Inmovilidad (*Immobility*)** | Imposibilidad de reutilizar un módulo porque está soldado a su entorno actual. | Extraer la lógica pura de negocio de las bibliotecas de infraestructura3. | Eleva la reutilización de código entre diferentes aplicaciones3. |
| **G4** | **Opacidad (*Opacity*)** | Código difícil de comprender que exige un alto esfuerzo cognitivo. | Refactorizar nombres, reducir tamaño de funciones y aplicar el principio SLAP5. | Facilita la integración de nuevos desarrolladores e IAs al proyecto19. |
| **G5** | **Envidia de Características** | Un método accede a los datos de otra clase más que a los suyos propios2. | Mover el método a la clase que posee y gestiona la estructura de datos. | Incrementa la cohesión interna y respeta la encapsulación3. |
| **G6** | **Choque de Trenes** | Cadenas de llamadas anidadas del tipo a.getB().getC().getD().execute(). | Aplicar la Ley de Demeter: interactuar solo con colaboradores directos2. | Evita acoplamientos profundos con estructuras de datos internas. |
| **G7** | **Obsesión por Primitivos** | Uso masivo de tipos nativos (string, int) para conceptos con validaciones. | Crear Objetos de Valor (*Value Objects*) e inmutables mediante Newtype o Dataclasses10. | Centraliza las validaciones y evita la dispersión de reglas de datos. |

## **3. Idiomas y Prácticas Limpias Específicas por Lenguaje**

### **3.1. Idiomas y Prácticas Limpias en Rust**

1. **Patrón Newtype**: Envuelve tipos primitivos en *structs* de un solo elemento para garantizar la seguridad de tipos en tiempo de compilación y evitar la obsesión por primitivos9.  
2. **Patrón Typestate**: Codifica los estados de un objeto y sus transiciones válidas en el sistema de tipos de Rust mediante genéricos no instanciados o *structs* de estado, impidiendo invocar métodos en estados inválidos en tiempo de compilación10.  
3. **Borrowing sobre Cloning**: Las firmas de funciones deben aceptar referencias prestadas (\&str, &\[T\], \&Path) en lugar de exigir la propiedad asignada (String, Vec<T>, PathBuf), reservando .clone() para decisiones de diseño explícitas y documentadas9.  
4. **Gobernanza Asíncrona (Tokio / Async)**:  
   * NUNCA retengas un guardia de std::sync::Mutex a través de un punto de espera (.await)9.  
   * NUNCA ejecutes código bloqueante o intensivo en CPU directamente en el bucle de eventos asíncrono; delega dichas tareas a tokio::task::spawn_blocking9.

### **3.2. Idiomas y Prácticas Limpias en Python**

1. **Anotaciones de Tipos Estrictas (Type Hints)**: Todo el código de producción debe estar 100% tipado mediante typing (Self, Unpack, Literal, Callable, Generic) y ser verificado estáticamente mediante mypy o pyright en modo estricto.  
2. **Subtipado Estructural mediante Protocol**: Prefiere typing.Protocol frente a Clases Base Abstractas (ABC) inherentes para definir contratos de puerto. Esto permite un acoplamiento débil (*duck typing* comprobado estáticamente) sin forzar jerarquías de herencia rígidas.  
3. **Inmutabilidad y DTOs**: Emplea @dataclass(frozen=True) o modelos Pydantic con frozen=True para representar Objetos de Valor y DTOs de frontera, garantizando inmutabilidad y comparación por valor.  
4. **Control del Estado Global**: Prohibida la modificación de variables globales a nivel de módulo o el uso de Singletons mutables. La configuración debe inyectarse explícitamente a través del constructor.

### **3.3. Idiomas y Prácticas Limpias en TypeScript**

1. **Tipado Estricto sin Escape**: Prohibido el uso de any. Emplea unknown para valores externos no conocidos y valida la estructura en la frontera mediante bibliotecas de esquemas (como Zod o Valibot) antes de consumir los datos9.  
2. **Tipos Unión Discriminados (*Discriminated Unions*)**: Modela estados y resultados de operaciones de dominio utilizando interfaces con una propiedad literal discriminante (ej. type Result<T> = { status: 'success'; data: T } | { status: 'error'; message: string }).  
3. **Inmutabilidad por Defecto**: Utilice readonly en propiedades de interfaces y ReadonlyArray<T> para colecciones dentro de las entidades del dominio para prevenir la mutación accidental del estado.  
4. **Interfaces Pequeñas y Compuestas**: Prefiere múltiples interfaces pequeñas e independientes en lugar de una interfaz masiva, permitiendo que las clases de la capa de infraestructura implementen solo los métodos requeridos por cada caso de uso.

## **4. Principios SOLID y Gobernanza de Componentes**

Los principios SOLID establecen las reglas de diseño para clases y módulos, mientras que los principios de componentes extienden esta filosofía al empaquetamiento y la organización de paquetes o módulos1.

### **4.1. Los Principios SOLID**

1. **Single Responsibility Principle (SRP)**: Un módulo, clase o archivo debe tener una, y solo una, razón para cambiar3. Debe responder exclusivamente a las necesidades de un único actor o rol del negocio4.  
2. **Open/Closed Principle (OCP)**: Las entidades de software deben estar abiertas a la extensión pero cerradas a la modificación3. Las nuevas funcionalidades deben incorporarse agregando nuevo código e implementaciones de contratos (*traits*, *protocols*, *interfaces*), no editando código existente ya probado3.  
3. **Liskov Substitution Principle (LSP)**: Los objetos o implementaciones de un tipo deben poder sustituir a sus abstracciones sin alterar la corrección del programa3. Las implementaciones concisas no deben debilitar las poscondiciones ni reforzar las precondiciones establecidas por la abstracción.  
4. **Interface Segregation Principle (ISP)**: Ningún cliente debe ser forzado a depender de métodos o contratos que no utiliza3. Se deben diseñar interfaces pequeñas y especializadas en lugar de abstracciones monolíticas3.  
5. **Dependency Inversion Principle (DIP)**: Los módulos de alto nivel no deben depender de módulos de bajo nivel; ambos deben depender de abstracciones (*traits*, *protocols*, *interfaces*)3. Las abstracciones no deben depender de los detalles; los detalles deben depender de las abstracciones.

### **4.2. Cohesión y Acoplamiento de Componentes**

#### **Principios de Cohesión de Componentes**

* **REP (Release-Reuse Equivalency Principle)**: El grano de reutilización equivale al grano de liberación3. Las clases y módulos agrupados en un componente deben pertenecer a la misma versión y liberarse juntos mediante un esquema semántico3.  
* **CCP (Common Closure Principle)**: Las clases que cambian ante un mismo motivo deben agruparse dentro del mismo componente o módulo3. Este principio aplica el SRP a nivel de componentes, reduciendo la cantidad de paquetes modificados durante un cambio3.  
* **CRP (Common Reuse Principle)**: Las clases de un componente que no son reutilizadas de forma conjunta no deben permanecer en el mismo paquete3. Este principio aplica el ISP a nivel de componentes para evitar dependencias innecesarias3.

#### **Principios de Acoplamiento de Componentes**

* **ADP (Acyclic Dependencies Principle)**: La estructura de dependencias entre componentes no debe contener ciclos3. Las dependencias deben organizarse como un Grafo Acíclico Dirigido (DAG)3.  
* **SDP (Stable Dependencies Principle)**: Las dependencias deben fluir siempre en la dirección de la estabilidad3. Un componente debe depender únicamente de módulos que posean un índice de estabilidad mayor al suyo3.  
* **SAP (Stable Abstractions Principle)**: Un componente debe ser tan abstracto como estable sea3. Los componentes estables de alto nivel deben apoyarse en abstracciones para permitir su extensibilidad1.

### **4.3. Métricas Arquitectónicas Cuantitativas**

Para auditar objetivamente la calidad del diseño modular, se aplican las siguientes métricas cuantitativas sobre cada componente o módulo del sistema:

#### **Métricas de Evaluación**

* **Acoplamiento Aferente (Ca)**: Número de clases o módulos externos que dependen de los elementos del módulo evaluado (mide responsabilidad)3.  
* **Acoplamiento Eferente (Ce)**: Número de clases o módulos externos que son utilizados por los elementos dentro del módulo evaluado (mide vulnerabilidad)3.  
* **Inestabilidad (I)**: Proporción entre el acoplamiento eferente y el acoplamiento total:

```
I = Ce / (Ca + Ce)
```

`I = 0` indica un componente máximamente estable (difícil de modificar porque muchos dependen de él)1. `I = 1` representa un componente totalmente inestable1.

* **Abstracción (A)**: Proporción entre el número de abstracciones (*interfaces*, *traits*, *protocols*, *abstract classes*, Na) y el número total de clases/tipos (Nc) dentro del componente:

```
A = Na / Nc
```

* **Distancia a la Secuencia Principal (D)**: Mide el grado de desviación de un componente respecto al equilibrio ideal entre abstracción e inestabilidad:

```
D = |A + I - 1|
```

`D ≈ 0` = sobre la Secuencia Principal (equilibrio ideal). Desviaciones grandes caen en las zonas de la tabla siguiente.

| Zona Arquitectónica | Coordenadas (I,A) | Diagnóstico Térmico | Impacto en la Mantenibilidad |
| :---- | :---- | :---- | :---- |
| **Zona de Dolor (*Zone of Pain*)** | I ≈ 0, A ≈ 0 | Componente altamente concreto y estable1. Difícil de extender1. | Crea rigidez crítica1. Típico de esquemas de bases de datos masivos o código legado sin interfaces1. |
| **Zona de Inutilidad (*Zone of Uselessness*)** | I ≈ 1, A ≈ 1 | Componente totalmente abstracto sin dependientes1. | Representa abstracciones innecesarias, código muerto o interfaces que no agregan valor1. |
| **Secuencia Principal (*Main Sequence*)** | D ≈ 0 | Equilibrio perfecto entre abstracción y estabilidad1. | Maximiza la reusabilidad y permite la evolución segura del software1. |

## **5. Macro-Arquitectura: Clean Architecture Poli-Lenguaje**

*Clean Architecture* unifies los principios de la Arquitectura Hexagonal (*Ports and Adapters*) y la Arquitectura Cebolla (*Onion Architecture*) en un esquema organizativo basado en capas concéntricas8.

### **5.1. La Regla de la Dependencia**

La norma fundamental de Clean Architecture establece que **las dependencias del código fuente solo pueden apuntar hacia adentro, dirigiéndose siempre hacia las políticas de mayor nivel de abstracción**3. El código situado en un círculo interior no puede conocer, importar ni mencionar ningún elemento declarado en las capas exteriores8.

### **5.2. Definición Estructurada de Capas**

| Capa Arquitectónica | Nivel de Abstracción | Tipos de Componentes | Reglas de Dependencia | Responsabilidad Técnica |
| :---- | :---- | :---- | :---- | :---- |
| **1. Entidades (*Entities*)** | Círculo Central / Alto Nivel1. | Entidades de Dominio, Objetos de Valor, Servicios del Dominio3. | Aislado de todo marco de trabajo, UI, ORM o base de datos8. | Encapsular las reglas y estructuras de negocio globales y fundamentales de la empresa8. |
| **2. Casos de Uso (*Use Cases*)** | Nivel Medio-Alto / Aplicación8. | Interactores, Puertos de Entrada/Salida, DTOs de Aplicación3. | Depende exclusivamente de la capa de Entidades8. | Orquestar el flujo de datos hacia y desde las Entidades para cumplir con los requerimientos del sistema8. |
| **3. Adaptadores de Interfaz** | Nivel Medio-Bajo / Traducción. | Controladores, Presentadores, Mapeadores, Repositorios Concretos. | Depende de Casos de Uso y Entidades8. | Convertir los datos entre el formato de la aplicación y la estructura requerida por agentes externos. |
| **4. Frameworks y Drivers** | Círculo Exterior / Bajo Nivel1. | Base de Datos, Framework Web, UI, SDKs de Terceros, CLI8. | Depende de los Adaptadores de Interfaz8. | Proveer la infraestructura técnica y los detalles de comunicación con el entorno exterior1. |

### **5.3. Screaming Architecture y Organización de Proyectos**

La estructura de carpetas debe comunicar de forma directa el propósito del negocio (*Screaming Architecture*), organizando los archivos por dominios funcionales antes que por capas técnicas genéricas4.

#### **Estructuras Idiomáticas Recomendadas por Lenguaje**

##### **Organización en Rust (Módulos o Workspace Crates)**

src/ ├── identity/ # Dominio Funcional de Identidad │ ├── domain/ # Entidades, Value Objects, Errores del Dominio │ │ ├── mod.rs │ │ ├── user.rs │ │ └── value_objects.rs │ ├── application/ # Casos de Uso y Puertos (Traits) │ │ ├── mod.rs │ │ ├── register_user.rs │ │ └── ports.rs │ └── infrastructure/ # Adaptadores, Database, Web Controllers │ ├── mod.rs │ ├── postgres_repo.rs │ └── http_handlers.rs └── main.rs # Compositor / Inyección de Dependencias

##### **Organización en Python (Paquetes de Dominio)**

src/ └── ordering/ # Dominio Funcional de Pedidos ├── domain/ # Entidades puras, Value Objects, Protocols │ ├── **init**.py │ ├── order.py │ └── value_objects.py ├── application/ # Casos de Uso y DTOs │ ├── **init**.py │ ├── create_order.py │ └── ports.py └── infrastructure/ # Repositorios SQLAlchemy/Peewee, FastAPI Routes ├── **init**.py ├── persistence.py └── controllers.py

##### **Organización en TypeScript (Módulos / Feature Folders)**

src/ └── billing/ # Dominio Funcional de Facturación ├── domain/ # Entidades, Interfaces del Dominio, Errores │ ├── Invoice.ts │ └── InvoiceId.ts ├── application/ # Casos de Uso, Puertos de Repositorio │ ├── GenerateInvoiceUseCase.ts │ └── InvoiceRepositoryPort.ts └── infrastructure/ # Adaptadores Express/Fastify, Prisma/TypeORM ├── TypeOrmInvoiceRepository.ts └── ExpressInvoiceController.ts

### **5.4. Patrón Humble Object, DTOs y Cruce de Fronteras**

Cuando los datos cruzan la frontera entre la infraestructura externa y el núcleo de la aplicación, se aplica el patrón **Humble Object**. Los módulos en los límites (como los controladores web o los consumidores de mensajes) se mantienen de forma "humilde", sin contención de lógica de negocio, limitándose a traducir y validar peticiones.  
El paso de información entre fronteras se realiza exclusivamente mediante Objetos de Transferencia de Datos (**DTOs**) planos o tipos primitivos3. **Queda estrictamente prohibido transmitir entidades del ORM, modelos con estado de base de datos o decoradores de frameworks hacia las capas de Aplicación o Dominio**8.

## **6. Ejemplos Comparativos de Código (Bad Code vs. Clean Code & Architecture)**

### **6.1. Ejemplo Completo en Rust**

#### **Antipatrón (Bad Code in Rust)**

Rust  
// MAL: Violación de la regla de dependencias, mezcla de SQL con negocio,  
// uso de unwrap(), mutaciones globales y falta de abstracción.  
use sqlx::SqlitePool;

pub async fn process_payment_bad(pool: \&SqlitePool, user_id: i64, amount: f64) {  
    // Mezcla de detalles de BD en la función de negocio  
    let user = sqlx::query\!("SELECT * FROM users WHERE id = ?", user_id)  
        .fetch_one(pool)  
        .await  
        .unwrap(); // Anti-patrón: Panic potencial en producción

    if user.balance < amount {  
        panic\!("Insufficient funds"); // Anti-patrón: Choque de hilo sin manejo elegante  
    }

    let new_balance = user.balance - amount;  
      
    // Mutación directa de base de datos sin frontera arquitectónica  
    sqlx::query\!("UPDATE users SET balance = ? WHERE id = ?", new_balance, user_id)  
        .execute(pool)  
        .await  
        .unwrap();

    println\!("Payment processed for user {}", user_id);  
}

#### **Aplicación de Clean Architecture e Idiomas Limpios (Good Code in Rust)**

Rust  
// BIEN: Entidad pura, Value Objects, puertos mediante Traits, manejo de errores con Result  
// y desacoplamiento absoluto de SQLX o frameworks HTTP.

pub mod domain {  
    use thiserror::Error;

    #\[derive(Error, Debug, PartialEq)\]  
    pub enum DomainError {  
        #\[error("Insufficient funds for transfer: available {available}, required {required}")\]  
        InsufficientFunds { available: f64, required: f64 },  
        #\[error("Invalid amount: must be positive")\]  
        InvalidAmount,  
    }

    #\[derive(Debug, Clone, PartialEq)\]  
    pub struct Money(f64);

    impl Money {  
        pub fn new(amount: f64) -> Result<Self, DomainError> {  
            if amount <= 0.0 {  
                return Err(DomainError::InvalidAmount);  
            }  
            Ok(Self(amount))  
        }

        pub fn value(&self) -> f64 {  
            self.0  
        }  
    }

    pub struct Account {  
        id: u64,  
        balance: Money,  
    }

    impl Account {  
        pub fn new(id: u64, initial_balance: Money) -> Self {  
            Self { id, balance: initial_balance }  
        }

        pub fn withdraw(&mut self, amount: \&Money) -> Result<(), DomainError> {  
            if self.balance.value() < amount.value() {  
                return Err(DomainError::InsufficientFunds {  
                    available: self.balance.value(),  
                    required: amount.value(),  
                });  
            }  
            self.balance = Money::new(self.balance.value() - amount.value())?;  
            Ok(())  
        }

        pub fn balance(&self) -> \&Money {  
            &self.balance  
        }  
    }  
}

pub mod application {  
    use super::domain::{Account, DomainError, Money};  
    use async_trait::async_trait;

    #\[async_trait\]  
    pub trait AccountRepository: Send + Sync {  
        async fn find_by_id(&self, id: u64) -> Result<Option<Account>, String>;  
        async fn save(&self, account: \&Account) -> Result<(), String>;  
    }

    pub struct ProcessPaymentUseCase {  
        repo: Box<dyn AccountRepository>,  
    }

    impl ProcessPaymentUseCase {  
        pub fn new(repo: Box<dyn AccountRepository>) -> Self {  
            Self { repo }  
        }

        pub fn execute<'a>(&'a self, account_id: u64, raw_amount: f64) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send + 'a>> {  
            Box::pin(async move {  
                let amount = Money::new(raw_amount).map_err(|e| e.to_string())?;  
                let mut account = self  
                    .repo  
                    .find_by_id(account_id)  
                    .await?  
                    .ok_or_else(|| "Account not found".to_string())?;

                account.withdraw(\&amount).map_err(|e| e.to_string())?;  
                self.repo.save(\&account).await?;  
                Ok(())  
            })  
        }  
    }  
}

### **6.2. Ejemplo Completo en Python**

#### **Antipatrón (Bad Code in Python)**

Python  
# MAL: Mezcla de lógica de UI/Framework (FastAPI) con base de datos (SQLAlchemy)  
# y lógica de negocio dentro de la misma función de ruta.  
from fastapi import FastAPI, HTTPException  
from sqlalchemy import create_engine

app = FastAPI()  
db = create_engine("sqlite:///app.db").connect()

@app.post("/users/register")  
def register_user(data: dict):  
    # Sin tipos, sin DTO, dependiente de diccionario genérico  
    if "email" not in data or "@" not in data\["email"\]:  
        raise HTTPException(status_code=400, detail="Invalid email")

    # Consulta directa SQL/ORM en la ruta  
    existing = db.execute(f"SELECT * FROM users WHERE email = '{data\['email'\]}'").fetchone()  
    if existing:  
        raise HTTPException(status_code=400, detail="User exists")

    db.execute(f"INSERT INTO users (email, status) VALUES ('{data\['email'\]}', 'ACTIVE')")  
    return {"status": "ok"}

#### **Aplicación de Clean Architecture e Idiomas Limpios (Good Code in Python)**

Python  
# BIEN: Capas segregadas, uso de Protocols, Pydantic/Dataclasses inmutables,  
# excepciones explícitas y comprobación estática estricta con Mypy.  
from dataclasses import dataclass  
from typing import Protocol, Optional  
import re

# 1. Capa de Dominio (Domain)  
class DomainException(Exception):  
    """Excepción base del dominio."""

class InvalidEmailException(DomainException):  
    def __init__(self, email: str) -> None:  
        super().__init__(f"The email '{email}' has an invalid format.")

class UserAlreadyExistsException(DomainException):  
    def __init__(self, email: str) -> None:  
        super().__init__(f"A user with email '{email}' already exists.")

@dataclass(frozen=True)  
class Email:  
    value: str

    def __post_init__(self) -> None:  
        pattern = r"^\[\\w\.-\]+@\[\\w\.-\]+\.\\w+$"  
        if not re.match(pattern, self.value):  
            raise InvalidEmailException(self.value)

@dataclass  
class User:  
    user_id: Optional\[int\]  
    email: Email  
    is_active: bool = True

# 2. Capa de Aplicación (Application Ports & Use Cases)  
class UserRepository(Protocol):  
    def find_by_email(self, email: Email) -> Optional\[User\]:  
        ...  
    def save(self, user: User) -> User:  
        ...

@dataclass(frozen=True)  
class RegisterUserCommand:  
    email: str

class RegisterUserUseCase:  
    def __init__(self, user_repository: UserRepository) -> None:  
        self._user_repository = user_repository

    def execute(self, command: RegisterUserCommand) -> User:  
        email = Email(command.email)  
          
        if self._user_repository.find_by_email(email) is not None:  
            raise UserAlreadyExistsException(email.value)

        new_user = User(user_id=None, email=email)  
        return self._user_repository.save(new_user)

### **6.3. Ejemplo Completo en TypeScript**

#### **Antipatrón (Bad Code in TypeScript)**

TypeScript  
// MAL: Uso de 'any', acoplamiento a Express y Prisma dentro del controlador,  
// flag arguments y sin validación de fronteras.  
import { Request, Response } from 'express';  
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function handleCreateProduct(req: Request, res: Response) {  
    const data: any = req.body; // Anti-patrón: Fuga de tipos por 'any'

    // Lógica de negocio dispersa en el controlador  
    if (data.price <= 0) {  
        return res.status(400).send("Price must be positive");  
    }

    // Flag argument y mutación de estado directa  
    const product = await prisma.product.create({  
        data: {  
            name: data.name,  
            price: data.isDiscounted ? data.price * 0.8 : data.price,  
        }  
    });

    return res.json(product);  
}

#### **Aplicación de Clean Architecture e Idiomas Limpios (Good Code in TypeScript)**

TypeScript  
// BIEN: Tipado estricto, Prohibición total de 'any', Discriminated Unions para resultados,  
// Inversión de dependencias y DTOs explícitos.

// 1. Capa de Dominio (Domain)  
export class Money {  
    private constructor(public readonly amount: number) {}

    public static create(amount: number): Money {  
        if (amount <= 0) {  
            throw new Error("Money amount must be positive.");  
        }  
        return new Money(amount);  
    }

    public applyDiscount(percentage: number): Money {  
        const discounted = this.amount * (1 - percentage / 100);  
        return Money.create(discounted);  
    }  
}

export class Product {  
    constructor(  
        public readonly id: string,  
        public readonly name: string,  
        private _price: Money  
    ) {}

    public get price(): Money {  
        return this._price;  
    }  
}

// 2. Capa de Aplicación (Application Ports & Use Case)  
export interface ProductRepositoryPort {  
    save(product: Product): Promise<void>;  
}

export interface CreateProductDTO {  
    readonly id: string;  
    readonly name: string;  
    readonly priceAmount: number;  
}

export type Result<T, E> =   
    | { isOk: true; value: T }  
    | { isOk: false; error: E };

export class CreateProductUseCase {  
    constructor(private readonly productRepository: ProductRepositoryPort) {}

    public async execute(dto: CreateProductDTO): Promise<Result<Product, string>> {  
        try {  
            const money = Money.create(dto.priceAmount);  
            const product = new Product(dto.id, dto.name, money);

            await this.productRepository.save(product);  
            return { isOk: true, value: product };  
        } catch (error) {  
            return {   
                isOk: false,   
                error: error instanceof Error ? error.message : "Unknown error"   
            };  
        }  
    }  
}

## **7. Pruebas Automatizadas, TDD y Mantenibilidad**

Las pruebas automatizadas constituyen la garantía técnica para la refactorización continua. Un sistema sin pruebas automatizadas carece de la capacidad de evolucionar de forma segura.

### **7.1. Las Tres Leyes del TDD (Test-Driven Development)**

1. No se escribirá código de producción a menos que sea para hacer pasar una prueba unitaria que ha fallado.  
2. No se escribirá más de una prueba unitaria de la necesaria para confirmar el fallo; los errores de compilación se consideran fallos de prueba.  
3. No se escribirá más código de producción del estrictamente necesario para hacer pasar la prueba unitaria que actualmente falla.

### **7.2. El Criterio F.I.R.S.T. para Pruebas Limpias**

* **Fast (Rápidas)**: Las pruebas deben ejecutarse en milisegundos para permitir su uso constante.  
* **Independent (Independientes)**: Ninguna prueba debe depender de la ejecución o estado previo de otra.  
* **Repeatable (Repetibles)**: Deben ofrecer exactamente el mismo resultado en cualquier entorno de ejecución.  
* **Self-Validating (Auto-evaluables)**: La prueba debe retornar un resultado booleano claro (PASA o FALLA) sin requerir inspección manual de logs.  
* **Timely (Oportunas)**: Se deben escribir inmediatamente antes de implementar el código de producción.

### **7.3. Patrón Build-Operate-Check (AAA) y Dobles de Prueba**

Toda prueba debe estructurarse claramente en tres fases operativas:

1. **Arrange (Build)**: Configuración inicial del entorno, creación de datos e instanciación de dobles de prueba (*stubs/mocks*).  
2. **Act (Operate)**: Invocación del método específico bajo prueba.  
3. **Assert (Check)**: Validación estricta de las respuestas y los cambios de estado esperados.

#### **Estrategia por Lenguaje**

* **Rust**: Organizar pruebas unitarias en módulos internos marcados con #\[cfg(test)\]. Utilizar la caja mockall para generar dobles de prueba a partir de *traits* de aplicación.  
* **Python**: Utilizar el marco pytest favoreciendo el uso de *fixtures* inmutables y la librería pytest-mock para el aislamiento de dependencias.  
* **TypeScript**: Emplear marcos de pruebas rápidos como Vitest o Jest. Crear implementaciones en memoria (*In-Memory Fakes*) de los puertos de repositorio en lugar de recurrir excesivamente a *mocks* dinámicos.

## **8. Matriz de Gobernanza y Directiva Ejecutable Ampliada para Inteligencia Artificial**

Esta sección compila las directivas operativas que deben ser inyectadas en el contexto de la inteligencia artificial para automatizar la generación de código bajo los estándares de Clean Code y Clean Architecture en proyectos multilenguaje2.

### **8.1. Matriz de Reglas Técnicas y su Impacto Arquitectónico**

| Regla de Ingeniería / Principio | Anti-patrón a Prevenir | Ejemplo de Implementación | Efecto Técnico Garantizado |
| :---- | :---- | :---- | :---- |
| **Aislamiento del Dominio** | Inyectar librerías de ORM o marcos web en entidades de negocio8. | Definir Entidades como estructuras o clases puras sin decoradores de terceros8. | Independencia total de la infraestructura y portabilidad del núcleo de negocio8. |
| **Separación SLAP** | Mezclar consultas SQL o llamadas HTTP con lógica de cálculo dentro de la misma función19. | Encapsular la persistencia en Repositorios y la regla en Entidades3. | Facilidad para realizar pruebas unitarias aisladas en memoria sin I/O8. |
| **Uso de Puertos e Interfaces** | Instanciar clientes de base de datos o HTTP directamente en el caso de uso3. | Inyectar abstracciones (*traits*, *protocols*, *interfaces*) en el constructor3. | Permite intercambiar proveedores de servicios mediante Inversión de Control3. |
| **Inmutabilidad en Objetos de Valor** | Modificar propiedades de correos, montos o IDs directamente mediante asignación. | Retornar una nueva instancia inmutable ante cada modificación. | Elimina errores por efectos secundarios no controlados en el estado19. |
| **Uso de DTOs en Fronteras** | Retornar objetos de base de datos o modelos del ORM a los controladores web o UI19. | Convertir los datos a DTOs explícitos en la capa de adaptadores19. | Evita la fuga de detalles de la base de datos hacia las capas externas8. |

### **8.2. Prompts del Sistema Maestros (System Prompts para IA)**

Las siguientes directivas en lenguaje imperativo no ambiguo deben incluirse en los archivos de configuración del agente de IA (.cursorrules, .github/copilot-instructions.md, CLAUDE.md, .windsurfrules o prompts de sistema)2.

#### **Directiva General de Arquitectura (Para Todos los Lenguajes)**

# **REGLAS DE OBLIGADO CUMPLIMIENTO: CLEAN ARCHITECTURE & CLEAN CODE**

Usted actúa como un Ingeniero Principal de Software especializado en Clean Architecture, SOLID y Software Craftsmanship. Todo código generado debe cumplir estrictamente con las siguientes reglas no negociables:

1. REGLAS ARQUITECTÓNICAS Y ESTRUCTURA DE DEPENDENCIAS  
* DEBE organizar la estructura del proyecto por dominios funcionales (Screaming Architecture) antes que por componentes técnicos.  
* DEBE asegurar que las dependencias de código apunten estrictamente hacia el centro de la arquitectura: Infraestructura -> Adaptadores -> Aplicación -> Dominio.  
* NUNCA importe marcos web (FastAPI, Express, Actix), ORMs (SQLAlchemy, Prisma, SQLx), ni librerías de I/O en la capa de Dominio o Casos de Uso.  
* DEBE utilizar el patrón Humble Object en la frontera: los controladores HTTP, CLI o consumidores de colas DEBEN limitarse a la recepción, traducción de DTOs e invocación de Casos de Uso.  
2. REGLAS DE MICRO-ARQUITECTURA Y CLEAN CODE  
* DEBE aplicar el principio de Single Level of Abstraction (SLAP) en cada función.  
* NUNCA cree funciones que superen las 20 líneas de código ni métodos que acepten más de 3 argumentos.  
* NUNCA utilice parámetros booleanos para alternar el comportamiento interno de una función (flags). Divida la operación en métodos independientes.  
* DEBE evitar comentarios descriptivos del "qué hace el código". El código DEBE ser autoexplicativo mediante nombres expresivos y alineados con el lenguaje ubicuo.  
3. FRONTERAS Y DTOs  
* DEBE utilizar DTOs planos para transferir datos a través de los límites de los Casos de Uso.  
* NUNCA retorne ni exponga Entidades de Dominio directamente a la capa de Infraestructura o controladores web.  
4. REGLAS DE REFACTORIZACIÓN Y MODIFICACIÓN  
* DEBE realizar modificaciones quirúrgicas al editar código. NUNCA reescriba archivos completos cuando una edición delimitada sea suficiente.  
* DEBE acompañar cada modificación o adición con sus correspondientes pruebas unitarias estructuradas bajo el patrón Arrange-Act-Assert (AAA).

#### **Directivas Específicas por Lenguaje**

##### **Configuración para Rust**

# **ESPECIFICACIONES OBLIGATORIAS PARA RUST**

* DEBE utilizar el patrón Newtype para encapsular primitivos que contengan validaciones o semántica de dominio.  
* DEBE representar errores de dominio con 'enums' fuertemente tipados utilizando 'thiserror'. NUNCA use 'String' ni 'Box' en la capa de Dominio.  
* NUNCA utilice '.unwrap()' ni '.expect()' en código de producción. Propague errores con el operador '?'.  
* DEBE definir los puertos de aplicación mediante 'async_trait' o 'traits' nativos.  
* DEBE preferir préstamos referencias ('\&str', '&\[T\]') en las firmas de funciones en lugar de forzar asignaciones de propiedad con '.clone()'.  
* NUNCA retenga un 'std::sync::MutexGuard' a través de un punto de espera '.await' en contextos asíncronos.

##### **Configuración para Python**

# **ESPECIFICACIONES OBLIGATORIAS PARA PYTHON**

* DEBE incluir anotaciones de tipos completas y estrictas en el 100% de las funciones y métodos.  
* DEBE utilizar 'typing.Protocol' para definir abstracciones de puertos sin forzar acoplamiento por herencia.  
* DEBE emplear '@dataclass(frozen=True)' o modelos 'Pydantic' inmutables para definir Objetos de Valor y DTOs.  
* NUNCA utilice bloques 'except Exception:' vacíos o pasivos. Capture únicamente excepciones específicas del dominio o la infraestructura.  
* DEBE asegurarse de que las Entidades del Dominio sean clases puras sin decoradores del ORM (ej. no herede de Base en SQLAlchemy dentro del Dominio).

##### **Configuración para TypeScript**

# **ESPECIFICACIONES OBLIGATORIAS PARA TYPESCRIPT**

* NUNCA utilice el tipo 'any'. Si procesa entradas desconocidas, utilice 'unknown' y valide la estructura en la frontera utilizando esquemas de Zod o Valibot.  
* DEBE marcar las propiedades de las interfaces del dominio con 'readonly' y utilizar 'ReadonlyArray' para colecciones.  
* DEBE preferir tipos Unión Discriminados ('Discriminated Unions') o tipos 'Result<T, E>' para el retorno de operaciones propensas a fallos en el dominio.  
* DEBE definir interfaces pequeñas y enfocadas para los repositorios de aplicación en lugar de interfaces consolidadas monolíticas.

## **9. Conclusiones y Gobernanza Tecnológica**

La adopción de Clean Code y Clean Architecture en proyectos poli-lenguaje (Rust, Python y TypeScript) garantiza la sostenibilidad técnica del software a largo plazo, conteniendo los costos operacionales y evitando la degradación del sistema1. Aislar las reglas del negocio respecto a los detalles de la infraestructura protege al sistema contra la obsolescencia tecnológica y permite actualizar bibliotecas, cambiar ORMs o adaptar interfaces web con un bajo radio de impacto1.  
En entornos de desarrollo asistidos por Inteligencia Artificial, el uso de directivas explícitas e imperativas previene la inyección inadvertida de código acoplado, redundante o inseguro2. El cumplimiento riguroso de estas normas, respaldado por pruebas unitarias automatizadas y auditorías cualitativas, asegura la entrega continua de software robusto, escalable y mantenible3.

#### **Obras citadas**

> 1. 5-Minute Lesson on Clean Architecture | by Angelo Buono, [https://levelup.gitconnected.com/5-minute-lesson-on-clean-architecture-83e4c0ed9184](https://levelup.gitconnected.com/5-minute-lesson-on-clean-architecture-83e4c0ed9184)  
> 2. btseee/clean-code-skills - GitHub, [https://github.com/btseee/clean-code-skills](https://github.com/btseee/clean-code-skills)  
> 3. From Coder to Conductor - Medium, [https://medium.com/@harvathsteven/from-coder-to-conductor-ad1ae3d1ec14](https://medium.com/@harvathsteven/from-coder-to-conductor-ad1ae3d1ec14)  
> 4. Uncle Bob's Clean Architecture (Cheat Sheet) | by Radosław Tywanek, [https://medium.com/@radoslaw.tywanek/uncle-bobs-clean-architecture-cheat-sheet-b9694348323d](https://medium.com/@radoslaw.tywanek/uncle-bobs-clean-architecture-cheat-sheet-b9694348323d)  
> 5. Summary of 'Clean code' by Robert C. Martin - GitHub Gist, [https://gist.github.com/wojteklu/73c6914cc446146b8b533c0988cf8d29](https://gist.github.com/wojteklu/73c6914cc446146b8b533c0988cf8d29)  
> 6. ai-driven-dev/prompts - GitHub, [https://github.com/ai-driven-dev/prompts](https://github.com/ai-driven-dev/prompts)  
> 7. GitHub - charlax/professional-programming: A collection of learning, [https://github.com/charlax/professional-programming](https://github.com/charlax/professional-programming)  
> 8. Clean Architecture: A Craftsman's Guide to Software Structure and, [https://derekarmstrong.dev/books/clean-architecture/](https://derekarmstrong.dev/books/clean-architecture/)  
> 9. Rust Best Practices 2026: Security, Idioms & Error Handling - Corgea, [https://corgea.com/learn/rust-security-best-practices](https://corgea.com/learn/rust-security-best-practices)  
> 10. How to implement clean architecture in rust? - Reddit, [https://www.reddit.com/r/rust/comments/ogxxc6/how_to_implement_clean_architecture_in_rust/](https://www.reddit.com/r/rust/comments/ogxxc6/how_to_implement_clean_architecture_in_rust/)  
> 11. The Clean architecture | Clean Coder Blog - Uncle Bob, [https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)  
> 12. Clean Code Cheat Sheet | Softensity, [https://www.softensity.com/blog/clean-code-cheat-sheet/](https://www.softensity.com/blog/clean-code-cheat-sheet/)  
> 13. GitHub - ryanmcdermott/clean-code-javascript, [https://github.com/ryanmcdermott/clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript)  
> 14. bathtub: Clean Code concepts and tools adapted for .NET · GitHub, [https://github.com/thangchung/clean-code-dotnet](https://github.com/thangchung/clean-code-dotnet)  
> 15. Clean Code: Second Edition Critique, [https://bugzmanov.github.io/cleancode-critique/clean_code_second_edition_review.html](https://bugzmanov.github.io/cleancode-critique/clean_code_second_edition_review.html)  
> 16. 7 Rust Idioms for Clean, High-Performance Code | by Jamesmiller, [https://medium.com/@jamesmiller22871/7-rust-idioms-for-clean-high-performance-code-6d7433e66d65](https://medium.com/@jamesmiller22871/7-rust-idioms-for-clean-high-performance-code-6d7433e66d65)  
> 17. mre/idiomatic-rust: A peer-reviewed collection of articles/talks/repos, [https://github.com/mre/idiomatic-rust](https://github.com/mre/idiomatic-rust)  
> 18. Python Idioms in Rust - Ben Congdon, [https://benjamincongdon.me/blog/2018/03/23/Python-Idioms-in-Rust/](https://benjamincongdon.me/blog/2018/03/23/Python-Idioms-in-Rust/)  
> 19. Is it still worth reading Clean Code and The Pragmatic Programmer, [https://www.reddit.com/r/ExperiencedDevs/comments/1rohhkv/is_it_still_worth_reading_clean_code_and_the/](https://www.reddit.com/r/ExperiencedDevs/comments/1rohhkv/is_it_still_worth_reading_clean_code_and_the/)  
> 20. Clean Architecture with .NET (Developer Reference) [1, [https://dokumen.pub/clean-architecture-with-net-developer-reference-1nbsped-0138203288-9780138203283.html](https://dokumen.pub/clean-architecture-with-net-developer-reference-1nbsped-0138203288-9780138203283.html)  
> 21. aj03794/clean-architecture: Notes on Robert Martin's The ... - GitHub, [https://github.com/aj03794/clean-architecture](https://github.com/aj03794/clean-architecture)  
> 22. How to Write Robust Prompt Files for VS Code, [https://new.danielbroadhurst.co.uk/posts/how-to-write-robust-prompt-files-for-vs-code-engineering-your-ai-workflow/](https://new.danielbroadhurst.co.uk/posts/how-to-write-robust-prompt-files-for-vs-code-engineering-your-ai-workflow/)

## **Apéndice V. Adaptación Ego (normativo para agentes del repo)**

Este apéndice aterriza la guía genérica (§1–§8) en la realidad del workspace Ego. En caso de conflicto entre un ejemplo genérico (§5.3, §6) y esta sección, **manda esta sección**.

### V.1 Mapa capas → repo real

| Capa Clean | Dónde vive en Ego | Frontera exigible |
|---|---|---|
| Entidades | `src/node/`, `src/graph.rs`, `src/entity/` (tipos + reglas puras) | Sin `sqlx`/`prisma`/`sqlalchemy`, sin HTTP, sin PyO3/WASM |
| Casos de uso | `src/engine.rs`, `src/executor.rs`, `src/planner.rs`, `src/sdk/` | Dependen solo de entidades + puertos (`trait`/`Protocol`/interfaz) |
| Adaptadores | `src/backends/`, `src/storage/`, `src/server/`, `src/cli_server.rs` | SQL/HTTP/CLI solo aquí; convierten a DTOs |
| Frameworks/Drivers | `Ego-python/` (PyO3), `Ego-wasm/`, `Ego-ts/`, `Ego-server/`, `web/` | **Humble Objects**: traducen DTO ↔ mundo externo, cero lógica de negocio |
| Composición | `src/bin/`, `src/lib.rs`, `dev-tools/verify.ps1`, `Justfile` | DI manual en el borde exterior |

Nota honesta: `src/` es hoy plano por módulo técnico, no por dominio funcional (§5.3 *Screaming Architecture* es aspiracional). No reorganizar carpetas sin ADR; auditar **dirección de dependencias**, no forma de carpetas.

### V.2 Correspondencia con reglas duras existentes

| Guía (§) | Regla Ego que ya la enforcea | Archivo |
|---|---|---|
| Humble Object, DTOs en frontera (§5.4, §8.1) | Regla 3 (docs sync), `api-contract.md` | `.agents/rules/api-contract.md` |
| Tokio: no `MutexGuard` sobre `.await`, no bloqueo en loop (§3.1) | Regla 8 + `concurrency-async.md` | `.agents/rules/concurrency-async.md` |
| `unwrap/expect` prohibido, `Result` + `?` (§2.3) | Clippy deny warnings + Regla 4 (`unsafe`/`SAFETY`) | `dev-tools/verify.ps1` |
| FIRST, AAA, TDD (§7) | `test-suite.md`, `testing-patterns.md` | `.agents/references/` |
| No optimizar sin medir (§9 de facto) | Regla 9 (`canonical_p99`), Regla 11 (claims) | `.agents/AGENTS.md` |
| Boy Scout (§1) | Regla 6 (deuda neta ≤ 0 por PR) | `.agents/AGENTS.md` |

### V.3 Naming: regla "Don't Add Gratuitous Context" (stuttering)

El libro (cap. 2) lo llama ***Don't Add Gratuitous Context***: `accountAddress` dentro de `Account` sobra → `address`. Aplica a:
- Rust: `EntityStore::entity_get` → `get`; `Entity::entity_id` → `id`; `ConnectionPool::pool_saturated` → `is_saturated`; `Error::IoError` → `Error::Io`.
- Excepciones legítimas (NO tocar): convención `ComponentProps` en TS, alias `deprecated` de compatibilidad, namespaces i18n (`tt("footer.*")`), `data-testid` jerárquicos, pseudo-elementos CSS.

### V.4 Severidades para `/cleanCA`

- **🔴 Bloqueante**: dependencia outward (dominio importa infraestructura), `unwrap()` en prod, `any`, `except:` vacío, `MutexGuard` sobre `.await`, SQL/ORM en entidad.
- **🟡 Deuda**: función >20 líneas o >3 args, flag-bool, stuttering, primitivo obsesivo sin Newtype/Value Object, comentario redundante, DTO ausente en frontera.
- **🟢 Sugerencia**: micro-naming, orden vertical, BEM en CSS nuevo.

Toda deuda 🟡/🔴 nueva en un PR debe pagarse según Regla 6 (saldo neto ≤ 0).












