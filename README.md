# Rust WebUI Application Starter

A modern, production-ready desktop application template that combines the raw performance of Rust with the rich ecosystem of React for building cross-platform desktop applications. This starter kit delivers a fully functional foundation for developers who demand both type safety and rapid UI development.

## Why This Stack

This project exists because building desktop applications from scratch is unnecessarily difficult. Traditional approaches force developers to choose between performance and productivity, or between native code and web technologies. This starter eliminates that compromise by leveraging WebUI, a framework that renders web content using the operating system's native webview while maintaining direct communication with Rust backend logic.

The architecture separates concerns cleanly: Rust handles system integration, data persistence, and business logic, while React manages the user interface through familiar component-based patterns. The two layers communicate through a bridge that transmits typed data and events in both directions, giving you the best of both worlds without sacrificing either performance or developer velocity.

Developers choose this stack for specific reasons that matter in production environments. Rust's zero-cost abstractions mean your backend code executes with native speed, and its memory safety guarantees eliminate entire categories of bugs that plague desktop applications. React's component model and extensive ecosystem provide everything needed to build complex, responsive interfaces quickly. When you combine these strengths with rspack's blazing-fast bundling, you get a development experience that feels lightweight despite producing fully-featured desktop software.

## Project Architecture

The application follows a deliberate three-layer architecture that scales from simple prototypes to complex production applications. Each layer has a distinct purpose and set of responsibilities, making it easy to extend functionality without contaminating existing code.

The presentation layer contains all user interface code, written in TypeScript and React. This layer never directly accesses the filesystem, database, or system APIs. Instead, it requests operations through well-defined channels and receives results through event callbacks. This separation means your interface remains responsive even when the backend performs heavy computations, and it means interface changes never risk destabilizing backend logic.

The application layer coordinates between the presentation and infrastructure layers. It receives requests from the frontend, validates inputs, invokes appropriate services, and formats responses. This layer contains the handlers that WebUI binds to JavaScript events, translating calls like `getUsers()` into database queries and returning structured results. By keeping this coordination logic separate from both the interface and the system abstractions, the codebase remains testable and maintainable.

The infrastructure layer provides low-level capabilities that higher layers consume. SQLite handles data persistence. The configuration system loads settings from TOML files with sensible defaults. The logging system captures runtime information for debugging and auditing. Each infrastructure component exposes a clean API that hides platform-specific details behind a uniform interface, ensuring your application code remains portable across Linux, macOS, and Windows.

## Directory Structure

The project root contains everything needed to build, run, and distribute the application. Understanding this structure helps you navigate the codebase confidently and locate the files you need to modify.

```
starter-rust-webuireact-rspack/
├── src/                          # Rust backend source code
│   ├── main.rs                   # Application entry point
│   ├── core.rs                   # Core infrastructure (config, logging, database)
│   └── handlers.rs               # WebUI event handlers
├── frontend/                     # React frontend application
│   ├── src/
│   │   ├── main.tsx              # React application entry point
│   │   ├── use-cases/
│   │   │   └── App.tsx           # Main application component
│   │   └── utils.js              # JavaScript utilities
│   ├── rspack.config.ts          # Production bundler configuration
│   ├── rspack.config.dev.ts      # Development bundler configuration
│   ├── rspack.config.inline.ts   # Inline asset configuration
│   ├── package.json              # Node.js dependencies
│   ├── tsconfig.json             # TypeScript configuration
│   └── biome.json                # Code formatting rules
├── static/                       # Compiled frontend assets (generated)
├── dist/                         # Distribution packages (generated)
├── Cargo.toml                    # Rust package configuration
├── app.config.toml               # Runtime configuration file
├── build.rs                      # Build script for native dependencies
├── build-frontend.js             # Frontend build automation
├── build-dist.sh                 # Distribution packaging script
├── run.sh                        # Development workflow script
└── README.md                     # This documentation
```

## Backend Components

The Rust backend consists of three primary files, each serving a distinct role in the application architecture. This minimal surface area makes the codebase approachable while remaining extensible as requirements grow.

### main.rs (189 lines)

This file serves as the application's entry point and orchestration center. It performs all initialization tasks in a deliberate sequence, ensuring that dependencies are available before they are required.

The initialization sequence begins with configuration loading. The application reads `app.config.toml` from several potential locations, allowing users to place configuration files in project roots, dedicated config directories, or specify custom paths through environment variables. If no configuration file exists or parsing fails, the application gracefully falls back to sensible defaults, ensuring the application remains functional even in unexpected states.

After configuration, the logging system initializes with settings from the configuration file. Log messages write to both standard output and a rotating log file, capturing timestamps, severity levels, and structured metadata. This dual output approach supports both live debugging during development and persistent logging in production environments.

The database initialization follows logging setup. The application opens a SQLite database connection, enables WAL mode for improved concurrency, and creates required tables if they do not already exist. When configured to do so, the application populates the database with sample data, providing an immediate demonstration of data persistence capabilities.

The HTTP server for frontend assets starts on a configurable port, serving static files from the compiled frontend directory. This server runs in a separate thread, allowing the main thread to focus on WebUI event handling. The server interprets request paths, determines appropriate file locations, sets correct MIME types, and returns appropriate responses or error codes.

Finally, the application creates the WebUI window, registers all event handlers, loads the frontend URL, and enters the event loop. This loop processes JavaScript calls from the frontend, invokes appropriate handlers, and returns results. The application remains running until all windows close, at which point cleanup routines execute and the process terminates.

### core.rs (284 lines)

This module consolidates infrastructure components that other parts of the application depend upon. Rather than scattering configuration, logging, and database code across multiple files, this consolidation provides a single import point for foundational capabilities.

The `AppConfig` struct defines the application's configuration schema using Serde's derive macros. Four sections cover application metadata, database settings, window configuration, and logging preferences. The struct includes getter methods that provide read-only access to configuration values, preventing accidental modification during runtime. The `load()` method implements a fallback chain that checks multiple paths and environment variables before returning either a parsed configuration or defaults.

The `Logger` struct implements the `log` trait from the `log` crate, providing custom logging behavior that writes to both console and file. Each log entry includes a timestamp with millisecond precision, the log level, the target module, and the message content. The logger checks whether each message should be emitted based on the configured filter level, ensuring that debug messages do not clutter production logs while important events always appear.

The `init_logging_with_config()` function establishes the logger as the global logging implementation. It accepts file path, level, and append mode parameters, parsing the level string into the appropriate filter enum. The function also checks the `RUST_LOG` environment variable, allowing runtime log level adjustment without modifying configuration files.

The `Database` struct wraps a SQLite connection in thread-safe synchronization primitives. The `Arc<Mutex<Connection>>` pattern allows multiple threads to share the same database connection without data races or corruption. The constructor enables WAL mode, which significantly improves performance for concurrent read operations by separating write-ahead logs from the main database file. The `init()` method creates the users table with appropriate constraints, and `insert_sample_data()` populates the table with demonstration records when it is empty.

### handlers.rs (107 lines)

This module contains all WebUI event handler registrations, binding JavaScript function calls to Rust implementations. Each handler group has its own setup function, keeping the registration logic organized and making it easy to add new handlers incrementally.

The module uses a lazy_static singleton to hold the database reference, allowing handlers to access the database without receiving it as a parameter. The `init_database()` function populates this singleton during application startup, after which all handlers can access it through the `DATABASE` static.

Seven handler setup functions exist, each binding one or more event names to closures that process requests. The `setup_ui_handlers()` function registers handlers for counter operations. The `setup_counter_handlers()` function handles counter value retrieval. Database handlers in `setup_db_handlers()` respond to user queries and statistics requests. System information handlers in `setup_sysinfo_handlers()` return hardware and operating system details. Utility handlers in `setup_utils_handlers()` process folder and image operations. Advanced and enhanced handlers provide stubs for additional functionality.

Each handler follows a consistent pattern: receive the event, log the event for debugging purposes, process the request using infrastructure components, and return a result to JavaScript. The logging helps developers trace event flow during development, while the consistent structure makes it straightforward to implement new handlers by following established patterns.

### Cargo.toml

The Cargo manifest declares all Rust dependencies with specific versions that ensure reproducible builds. The package metadata identifies the application, specifies the Rust edition, and configures release profile optimizations.

Key dependencies include webui-rs for the bridge between Rust and web content, rusqlite for SQLite database access with bundled SQLite implementation, tokio for asynchronous runtime capabilities, and tiny_http for serving frontend assets. The serde ecosystem provides configuration parsing and JSON serialization. The chrono crate supplies timestamp generation for logs, and lazy_static enables static variable initialization that depends on runtime configuration.

The release profile configuration enables link-time optimization and single codegen unit compilation, producing the smallest and fastest possible binaries. These optimizations trade compilation time for runtime performance, which is appropriate for production builds but intentionally disabled during development.

## Frontend Components

The frontend application uses React for component-based user interface development, TypeScript for type safety, and rspack for high-performance bundling. This combination delivers excellent developer experience while producing optimized production assets.

### main.tsx (42 lines)

This file serves as the React application's entry point, following the standard pattern established by Create React App and maintained by contemporary tooling. The code demonstrates defensive programming practices that ensure the application provides useful feedback even when unexpected errors occur.

The entry point first logs diagnostic information that helps developers understand the application startup sequence. It then attempts to locate the root DOM element by ID, creating a React root and rendering the application within it. If any step fails, the code catches the exception and displays an error message directly in the document body, preventing the application from failing silently.

Global error handlers capture uncaught exceptions and unhandled promise rejections, logging them to the console for debugging purposes. These handlers ensure that runtime errors provide maximum information for diagnosis, even when they occur in event handlers or asynchronous callbacks.

### use-cases/App.tsx (876 lines)

The main application component implements the complete user interface, including window management, database visualization, and system information display. This file demonstrates how to structure a complex React application using hooks for state management and side effects.

The component maintains several pieces of state using the `useState` hook. The `activeWindows` array tracks open application windows, their minimization status, and references to their WinBox instances. The `dbUsers` array holds database records fetched from the backend. The `dbStats` object contains summary statistics about the database. The `isLoadingUsers` boolean tracks asynchronous operation status.

Window creation uses the WinBox library, a lightweight window management library that provides familiar minimize, maximize, and close controls. The `openWindow()` function creates new windows with configurable titles, content, and icons. Each window registers callbacks for minimize, maximize, restore, and close events, keeping the `activeWindows` state synchronized with the actual window states.

The database viewer displays user records in a table with search and refresh capabilities. When opened, the window triggers JavaScript functions that communicate with the Rust backend, requesting user data and statistics. Responses arrive through custom events that the component listens for, updating state and re-rendering accordingly.

The system information window displays client-side information about the browser, operating system, and hardware. This information comes entirely from browser APIs and does not require backend communication, demonstrating how the frontend can function independently for read-only information display.

The component includes extensive inline styles that provide a dark theme appearance with consistent spacing, colors, and interactions. A responsive design ensures the layout adapts to smaller screens by repositioning the sidebar and adjusting the card grid.

### Configuration Files

The frontend uses three rspack configuration files that control how TypeScript code transforms into optimized JavaScript bundles. The production configuration enables tree shaking, minification, and code splitting. The development configuration preserves source maps and enables hot module replacement for rapid iteration. The inline configuration bundles assets directly into the HTML file for simplified distribution.

The `package.json` file declares dependencies on React and ReactDOM for the user interface, WinBox for window management, and various development dependencies including rspack for bundling, TypeScript for type checking, and Biome for formatting and linting. The scripts section defines convenient commands for building, linting, and formatting the codebase.

The `tsconfig.json` file configures TypeScript compilation, enabling strict type checking, JSX syntax support, and modern ECMAScript targets. The configuration ensures that type errors prevent builds and that the compiled code runs in contemporary browsers.

The `biome.json` file configures Biome, a fast formatter and linter for JavaScript and TypeScript. This configuration ensures consistent code style across the codebase and catches common mistakes before they enter production.

## Build System

The build system combines Rust compilation with frontend bundling, producing a self-contained application that requires no external dependencies beyond the operating system itself.

### Build Pipeline

The `run.sh` script orchestrates the complete build and execution process. It compiles Rust code using Cargo, builds frontend assets using rspack through bun, and launches the resulting application. The script accepts arguments for different build modes, allowing developers to build debug or release versions, run applications without rebuilding, or clean generated artifacts.

The `build-frontend.js` script invokes rspack with appropriate configuration, transforming TypeScript and React code into JavaScript bundles optimized for production. The script handles asset copying, HTML template generation, and cache invalidation automatically.

The `build.rs` script runs during Rust compilation, compiling the WebUI C library into a static archive that links with the application. This script uses the CC crate to invoke the platform C compiler, managing platform-specific compiler flags and include paths.

### Configuration Management

The application supports configuration through TOML files and environment variables. The `app.config.toml` file in the project root configures application name, version, database path, window title, and logging preferences. The configuration system provides sensible defaults, ensuring the application runs correctly even when configuration files are missing or incomplete.

## Communication Between Layers

The frontend and backend communicate through a bridge that transmits JavaScript function calls to Rust handlers and returns results through custom events. This pattern provides type safety through TypeScript interfaces while maintaining the flexibility needed for dynamic communication.

JavaScript code calls Rust functions by invoking `window.functionName()` where the function was bound during handler registration. These calls transmit any arguments as string data that Rust handlers parse as JSON. After processing, Rust handlers construct JavaScript code that dispatches custom events with results in the `detail` field.

The frontend registers event listeners for response events using `window.addEventListener()`. When events fire, handlers extract data from `event.detail`, update component state, and trigger re-renders. This decoupled architecture means the backend never holds references to JavaScript objects, and the frontend never accesses Rust memory directly.

## Extending the Application

This starter kit provides a foundation that you can extend in several directions based on your specific requirements.

To add new backend handlers, create a new function in `handlers.rs` that accepts a WebUI event, processes it using infrastructure components, and returns a result. Register the handler in `main.rs` using `window.bind()` with a unique event name. Add corresponding JavaScript functions in the frontend that call these handlers and handle their responses.

To add new frontend features, create additional React components in appropriate directories and import them into the main application. The existing component structure demonstrates how to manage state, respond to events, and integrate with the backend bridge.

To add new infrastructure capabilities, extend `core.rs` with new structs and functions that provide the required functionality. Dependencies should be added to `Cargo.toml` with appropriate version constraints. The clean separation between infrastructure and application logic ensures that low-level changes do not affect user-facing code.

## Getting Started

Clone the repository and navigate to the project directory. Install Rust through rustup if you have not already, ensuring you have a recent stable toolchain. Install bun for frontend package management using the official installation script.

Run `./run.sh` to build both the Rust backend and React frontend, then launch the application. The first build takes several minutes as it downloads dependencies and compiles both codebases. Subsequent builds are significantly faster as caching takes effect.

During development, you can modify either backend or frontend code and rebuild incrementally. The Rust backend requires recompilation for changes, while the frontend supports hot module replacement in development mode for instant feedback on interface changes.

## Production Deployment

The `build-dist.sh` script creates distribution packages containing the compiled application, configuration file, and static assets. These packages are self-contained and run on any system with the appropriate operating system, requiring no additional installation steps beyond extraction.

The release build configuration enables aggressive optimizations that reduce binary size and improve runtime performance. LTO (link-time optimization) allows the compiler to optimize across crate boundaries, and single codegen unit compilation enables more aggressive inlining decisions.

## License

This project is available under the terms of the MIT License, which permits unrestricted use, modification, and distribution of the software and its derivatives. See the LICENSE file for complete terms.
