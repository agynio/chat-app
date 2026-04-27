# Chat App

The Chat application provides the conversation interface for the Agyn platform.

Architecture: [Chat](https://github.com/agynio/architecture/blob/main/architecture/chat.md)

## Local Development

Full setup: [Local Development](https://github.com/agynio/architecture/blob/main/architecture/operations/local-development.md)

### Prepare environment

```bash
git clone https://github.com/agynio/bootstrap.git
cd bootstrap
chmod +x apply.sh
./apply.sh -y
```

See [bootstrap](https://github.com/agynio/bootstrap) for details.

### Run from sources

```bash
# Deploy once (exit when healthy)
devspace dev

# Watch mode (streams logs, re-syncs on changes)
devspace dev -w
```

### Run tests

```bash
pnpm lint
pnpm typecheck
pnpm test
```

E2E runs are centralized in the [agynio/e2e](https://github.com/agynio/e2e) repository.
Follow [E2E Testing](https://github.com/agynio/architecture/blob/main/architecture/operations/e2e-testing.md)
to provision the cluster and run `devspace run test-e2e --tag svc_chat_app` from the e2e repo.
