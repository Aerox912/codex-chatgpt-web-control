# Architecture diagrams

These diagrams are the visual companion to the standalone architecture and
implementation plan. They intentionally describe only
`codex-chatgpt-web-control`; integration with `agent-system` remains deferred.

The canonical safety invariant is:

> Share the browser process and authenticated partition, never the working
> page. Every active operation owns one exclusive host-issued lease.

## 1. Runtime architecture

```mermaid
flowchart TB
    CODEX["Codex Desktop / CLI"]
    ROUTE{"Requested route"}
    NATIVE["Native Responses passthrough"]
    WEB["codex-chatgpt-web adapter"]
    CONTROL["Visible-control service"]
    WORKER["Per-operation control worker"]
    UPSTREAM["Native Codex upstream"]
    HOST["Shared Electron BrowserHost"]
    AUTH["One authenticated persistent partition"]
    LEASES["Host-owned surface lease registry"]
    MODEL_PAGE["Exclusive model-turn page\nFresh Temporary Chat"]
    CONTROL_PAGE["Exclusive control page\nChat or Work"]
    REGISTRY["Durable Chat/Work session registry"]

    CODEX --> ROUTE
    ROUTE -->|"native model"| NATIVE
    ROUTE -->|"chatgpt-web/*"| WEB
    ROUTE -->|"Chat / Work operation"| CONTROL
    NATIVE --> UPSTREAM
    WEB -->|"lease kind=model-turn"| HOST
    CONTROL --> WORKER
    WORKER -->|"lease kind=control-*"| HOST
    HOST --> AUTH
    HOST --> LEASES
    LEASES --> MODEL_PAGE
    LEASES --> CONTROL_PAGE
    CONTROL_PAGE --> REGISTRY

    classDef authority fill:#2f6feb,color:#fff,stroke:#1f4f99,stroke-width:2px;
    classDef transient fill:#fff4ce,color:#24292f,stroke:#bf8700;
    classDef durable fill:#dafbe1,color:#24292f,stroke:#1a7f37;
    class HOST,LEASES authority;
    class MODEL_PAGE,CONTROL_PAGE transient;
    class REGISTRY durable;
```

## 2. Surface lease lifecycle

The exact transition table in
`packages/browser-leases/src/transitions.ts` is authoritative. This diagram
shows the principal execution and terminal paths.

```mermaid
stateDiagram-v2
    [*] --> Allocating

    Allocating --> Idle
    Allocating --> Navigating
    Idle --> Navigating
    Idle --> Submitting
    Navigating --> Idle
    Navigating --> Submitting
    Navigating --> Generating
    Submitting --> Generating
    Submitting --> Ready
    Generating --> Ready
    Ready --> Idle
    Ready --> Navigating
    Ready --> Submitting
    Ready --> Generating

    Allocating --> Blocked
    Idle --> Blocked
    Navigating --> Blocked
    Submitting --> Blocked
    Generating --> Blocked
    Ready --> Blocked
    Blocked --> Idle
    Blocked --> Navigating
    Blocked --> Submitting
    Blocked --> Ready

    Allocating --> Error
    Idle --> Error
    Navigating --> Error
    Submitting --> Error
    Generating --> Error
    Ready --> Error
    Blocked --> Error

    Allocating --> Releasing
    Idle --> Releasing
    Navigating --> Releasing
    Submitting --> Releasing
    Generating --> Releasing
    Ready --> Releasing
    Blocked --> Releasing
    Error --> Releasing
    Releasing --> Released
    Released --> [*]
```

## 3. Concurrent model and control work without page interference

```mermaid
sequenceDiagram
    autonumber
    participant C as Codex
    participant H as BrowserHost
    participant W as Web model worker
    participant V as Control worker
    participant T as Temporary Chat page
    participant P as Chat/Work page
    participant R as Session registry

    C->>H: Allocate model-turn lease A
    H-->>W: surface A + ownership marker
    C->>H: Allocate control-work lease B
    H-->>V: surface B + ownership marker

    par Web-model turn
        W->>T: Verify marker A
        W->>T: Navigate, configure, submit
        T-->>W: Reasoning, tools, Markdown
    and Visible Work task
        V->>P: Verify marker B
        V->>P: Open Work and submit once
        P-->>V: Exact task URL and state
        V->>R: Persist task identity
    end

    W->>H: Release lease A
    V->>H: Release lease B
    Note over T,P: Same browser process and login; never the same working page
```

## 4. Shared capacity and account scheduler

```mermaid
flowchart LR
    INPUT["Incoming operation"] --> CLASSIFY{"Classify"}
    CLASSIFY -->|"model continuation"| P100["Priority 100 / 90"]
    CLASSIFY -->|"control submit / steer"| P80["Priority 80 / 70"]
    CLASSIFY -->|"status / read"| P50["Priority 50"]
    CLASSIFY -->|"maintenance / smoke"| P20["Priority 20 / 10"]

    P100 --> QUEUE["One ordered scheduler"]
    P80 --> QUEUE
    P50 --> QUEUE
    P20 --> QUEUE

    QUEUE --> COOLDOWN{"Account cooldown?"}
    COOLDOWN -->|"yes: submission"| HOLD["Hold without resubmission"]
    COOLDOWN -->|"yes: safe read"| PAGE
    COOLDOWN -->|"no"| PAGE{"Active surfaces < 5?"}
    PAGE -->|"no"| WAIT_PAGE["Wait for page capacity"]
    PAGE -->|"yes"| GENERATION{"Needs generation slot?"}
    GENERATION -->|"no"| ALLOCATE["Allocate exclusive lease"]
    GENERATION -->|"yes"| GEN_CAP{"Generation policy allows?"}
    GEN_CAP -->|"no"| WAIT_GEN["Wait; include remote Work activity"]
    GEN_CAP -->|"yes"| ALLOCATE
    ALLOCATE --> RUN["Run on exact owned page"]
    RUN --> REMOTE{"Remote Work still running?"}
    REMOTE -->|"yes"| TRACK["Keep remote activity reservation"]
    REMOTE -->|"no"| RELEASE["Release page and capacity"]
    TRACK --> RELEASE

    classDef blocked fill:#ffebe9,stroke:#cf222e,color:#24292f;
    classDef active fill:#ddf4ff,stroke:#0969da,color:#24292f;
    class HOLD,WAIT_PAGE,WAIT_GEN blocked;
    class QUEUE,ALLOCATE,RUN active;
```

Initial policy:

```yaml
max_active_surfaces: 5
max_simultaneous_generations: 3
max_control_generations: 2
reserve_model_turn_slots: 1
```

## 5. Durable Chat and Work identity

```mermaid
sequenceDiagram
    autonumber
    participant API as Control API
    participant H as BrowserHost
    participant W as Control worker
    participant P as Leased Chat/Work page
    participant G as ChatGPT
    participant R as Durable registry

    API->>H: Request operation for session key
    H->>R: Resolve exact saved URL, if present
    H-->>W: Lease one exact control page
    W->>P: Verify ownership marker
    W->>P: Open exact URL or create new task
    P->>G: Visible user-directed operation
    G-->>P: Response or task reference
    P-->>W: Exact conversation/task URL and state
    W->>R: Atomic upsert of durable identity
    W->>H: Close and release page

    Note over H,R: Renderer lifetime is not persistence

    API->>H: Later operation, including after restart
    H->>R: Resolve the same exact URL
    H-->>W: New lease and new SDK client
    W->>P: Reopen exact saved conversation/task
```

## 6. Delivery dependency graph

```mermaid
flowchart LR
    M0["M0 Bootstrap + baselines\nNIC-378"]
    M1["M1 Shared host + leases\nNIC-379"]
    M2["M2 Chat / Work runtime\nNIC-380"]
    M3["M3 Scheduler + local API\nNIC-381"]
    M4["M4 Launcher + release\nNIC-382"]

    R["Repository + upstream ancestry\nNIC-383"]
    DOCS["Overlay docs + locks\nNIC-384"]
    BASE["Independent baselines\nNIC-385"]
    CONTRACTS["Lease contracts\nNIC-386"]
    MANAGER["Lease manager\nNIC-387"]
    COMPAT["beginTurn/endTurn facade\nNIC-388"]
    TESTS["Mixed isolation tests\nNIC-389"]
    ADAPTER["Browser contract adapter\nNIC-390"]
    RUNTIME["Per-operation control runtime\nNIC-391"]
    SESSIONS["Durable session registry\nNIC-392"]
    FLOWS["Chat, Work, files, artifacts\nNIC-393"]
    SCHED["Global scheduler\nNIC-394"]
    RATE["Cooldown + exclusive ops\nNIC-395"]
    API["Authenticated loopback API\nNIC-396"]
    WORKERS["Worker isolation\nNIC-397"]
    UI["Unified launcher views\nNIC-398"]
    CLIENTS["Codex + Node/Python interfaces\nNIC-399"]
    FALLBACK["Isolated-control fallback\nNIC-400"]
    RELEASE["Cross-platform RC\nNIC-401"]

    M0 --> M1 --> M2 --> M3 --> M4
    R --> M0
    DOCS --> M0
    BASE --> M0
    CONTRACTS --> MANAGER --> COMPAT --> TESTS --> M1
    M1 --> ADAPTER --> RUNTIME --> SESSIONS --> FLOWS --> M2
    M2 --> SCHED --> RATE --> API --> WORKERS --> M3
    M3 --> UI --> CLIENTS --> FALLBACK --> RELEASE --> M4

    classDef done fill:#dafbe1,stroke:#1a7f37,color:#24292f;
    classDef active fill:#ddf4ff,stroke:#0969da,color:#24292f;
    classDef planned fill:#f6f8fa,stroke:#8c959f,color:#24292f;
    class DOCS,CONTRACTS,MANAGER done;
    class R,M0,M1 active;
    class BASE,COMPAT,TESTS,ADAPTER,RUNTIME,SESSIONS,FLOWS,SCHED,RATE,API,WORKERS,UI,CLIENTS,FALLBACK,RELEASE,M2,M3,M4 planned;
```

## Diagram maintenance

- Update diagrams in the same change that modifies an architectural invariant.
- Keep issue identifiers aligned with Linear.
- Treat code contracts and tests as authoritative when a diagram becomes stale.
- Mirror these diagrams into the canonical Notion architecture page.
