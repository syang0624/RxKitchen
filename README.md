# RxKitchen

RxKitchen is a multi-agent clinical meal-allocation system for Project Open Hand. It turns hospital referrals into clinically safe weekly meal plans, kitchen production batches, and delivery routes while exposing each agent decision through a deterministic replay dashboard.

## Development

Install dependencies and start the Next.js development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm run lint
npm run data:validate
npm run build
```

The production build runs dataset validation first. Validation must report zero clinical violations before the application is considered demo-safe.

## Data Generation

```bash
npm run data:generate
npm run agents:generate
```

See [PRD.md](./PRD.md) for product requirements and [data/README.md](./data/README.md) for dataset contracts and regeneration rules.
