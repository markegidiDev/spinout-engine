from src.schemas import AgentTrace, DocumentAnalyzeResponse, EvidenceItem, EvidenceSection, VentureMemo


def build_demo_memo() -> VentureMemo:
    return VentureMemo.model_validate(
        {
            "title": "Low-latency Edge Inference for Industrial Sensor Anomaly Detection",
            "oneLineCompany": (
                "An edge AI monitoring layer that helps factories detect machine failures "
                "before downtime."
            ),
            "problem": (
                "Factories lose production time when vibration, temperature, and acoustic "
                "sensor anomalies are noticed after a machine has already drifted out of tolerance."
            ),
            "targetCustomer": (
                "Maintenance and operations leaders at mid-market discrete manufacturers with "
                "high-value production lines and limited in-house data science capacity."
            ),
            "initialWedge": (
                "Start with retrofit anomaly detection for CNC machines and packaging lines, "
                "where downtime costs are visible and sensor streams are already available."
            ),
            "whyNow": (
                "Lower-cost edge accelerators, reliable industrial gateways, and pressure to "
                "increase uptime make on-premise inference practical without sending sensitive "
                "factory data to cloud services."
            ),
            "technicalNovelty": (
                "The paper combines compressed temporal models with adaptive thresholds that "
                "run on low-power edge gateways while preserving early-warning accuracy."
            ),
            "technicalMoat": (
                "A defensible product could emerge from deployment data, per-machine calibration "
                "recipes, and integrations with industrial maintenance workflows."
            ),
            "productConcept": (
                "A plug-in monitoring service that ingests existing sensor feeds, runs low-latency "
                "edge inference, and surfaces ranked failure risks with recommended maintenance actions."
            ),
            "businessModel": (
                "Annual subscription per monitored production line, with paid onboarding for sensor "
                "mapping, threshold calibration, and maintenance-system integration."
            ),
            "competitors": [
                {
                    "name": "Cloud predictive maintenance platforms",
                    "whyRelevant": "They already sell anomaly detection and asset monitoring to factories.",
                    "differentiation": (
                        "Spinout can emphasize low-latency local inference, easier retrofit, and "
                        "reduced data-sharing concerns."
                    ),
                },
                {
                    "name": "Industrial IoT gateway vendors",
                    "whyRelevant": "Gateways can bundle analytics close to machines.",
                    "differentiation": (
                        "Focus on model quality, fast deployment, and operator-facing workflow rather "
                        "than generic connectivity."
                    ),
                },
                {
                    "name": "Internal maintenance analytics teams",
                    "whyRelevant": "Large manufacturers can build bespoke models.",
                    "differentiation": (
                        "Serve plants that need a deployable product without hiring a specialized ML team."
                    ),
                },
            ],
            "milestones": {
                "30days": [
                    "Interview 12 plant maintenance leaders and quantify downtime cost by line type.",
                    "Build a clickable workflow around alerts, evidence, and maintenance handoff.",
                    "Select two sensor protocols for the first integration path.",
                ],
                "60days": [
                    "Pilot edge inference on historical sensor data from one design partner.",
                    "Measure detection lead time, false positives, and gateway resource usage.",
                    "Define paid pilot scope and security requirements.",
                ],
                "90days": [
                    "Deploy to one live production line with human-in-the-loop alert review.",
                    "Integrate alert export into a CMMS or ticketing workflow.",
                    "Convert pilot results into a repeatable wedge for a second factory segment.",
                ],
            },
            "risks": [
                {
                    "risk": "Models may not generalize across machine types or plant conditions.",
                    "severity": "high",
                    "mitigation": "Start with one narrow machine class and build calibration tooling.",
                },
                {
                    "risk": "False positives could erode operator trust.",
                    "severity": "high",
                    "mitigation": "Expose evidence, confidence, and feedback loops before automation.",
                },
                {
                    "risk": "Industrial sales cycles can be slow.",
                    "severity": "medium",
                    "mitigation": "Sell paid pilots around measurable downtime reduction.",
                },
            ],
            "missingEvidence": [
                "Proof that the model sustains accuracy on live, noisy factory data.",
                "Measured willingness to pay for mid-market plants.",
                "Integration requirements for common industrial gateways and CMMS tools.",
            ],
            "investorQuestions": [
                "What specific machine type gives you the fastest paid pilot and why?",
                "How much downtime must you prevent to justify your annual subscription?",
                "What proprietary data advantage compounds after the first ten deployments?",
                "How will you keep false positives low enough for operators to trust alerts?",
                "Which incumbent will customers compare you against during procurement?",
            ],
            "pitch60s": (
                "Industrial plants already collect sensor data, but many still discover machine failures "
                "too late. Spinout Engine's demo company turns low-latency edge inference research into "
                "a monitoring layer for factories. It runs anomaly detection on local gateways, keeps "
                "sensitive data on site, and gives maintenance teams early warnings before downtime. "
                "The wedge is CNC and packaging lines at mid-market manufacturers, where downtime is "
                "expensive and teams lack ML capacity. The business starts as paid pilots and expands "
                "into annual subscriptions per monitored line."
            ),
            "confidence": 78,
        }
    )


def build_demo_response(session_id: str) -> DocumentAnalyzeResponse:
    return DocumentAnalyzeResponse(
        sessionId=session_id,
        memo=build_demo_memo(),
        evidence=[
            EvidenceItem(
                source="mock-paper:abstract",
                excerpt=(
                    "Compressed temporal inference on edge gateways detected early anomalies "
                    "with sub-second latency in industrial sensor streams."
                ),
            ),
            EvidenceItem(
                source="mock-paper:conclusion",
                excerpt=(
                    "Future work should validate robustness across machine classes and live "
                    "factory noise conditions."
                ),
            ),
        ],
        evidenceSections=[
            EvidenceSection(
                kind="abstract",
                title="Abstract excerpt",
                summary=(
                    "The demo paper describes an edge inference approach for industrial sensor streams. "
                    "It frames factory downtime as the core operational problem and positions low-latency "
                    "local analytics as a practical response. The excerpt supports the memo's focus on "
                    "predictive maintenance and early anomaly detection."
                ),
                source=(
                    "Compressed temporal inference on edge gateways detected early anomalies with "
                    "sub-second latency in industrial sensor streams."
                ),
                sourceLabel="Abstract",
            ),
            EvidenceSection(
                kind="technology",
                title="Technology excerpt",
                summary=(
                    "The technical basis is a compact temporal model that can run on edge gateways. "
                    "The model is designed to preserve early-warning accuracy while avoiding cloud-only "
                    "processing. This supports a product concept built around on-site inference and "
                    "factory data privacy."
                ),
                source=(
                    "The paper combines compressed temporal models with adaptive thresholds that run "
                    "on low-power edge gateways while preserving early-warning accuracy."
                ),
                sourceLabel="Technology / methods",
            ),
            EvidenceSection(
                kind="evidence",
                title="Evidence excerpt",
                summary=(
                    "The strongest evidence in the demo fixture is performance-oriented rather than "
                    "commercial. It indicates that the model can detect anomalies quickly in sensor "
                    "streams, but live factory validation is still needed. That limitation is reflected "
                    "in the memo's confidence and next milestones."
                ),
                source=(
                    "Early anomaly detection was measured on industrial sensor streams with sub-second "
                    "latency and reduced gateway resource usage."
                ),
                sourceLabel="Evidence / results",
            ),
            EvidenceSection(
                kind="limitations",
                title="Limitations excerpt",
                summary=(
                    "The fixture explicitly notes that robustness across machine classes and live noise "
                    "conditions remains unproven. This means the commercial memo should avoid claiming "
                    "broad deployment readiness. The next proof point is a narrow pilot on a specific "
                    "machine class."
                ),
                source=(
                    "Future work should validate robustness across machine classes and live factory "
                    "noise conditions."
                ),
                sourceLabel="Limitations / discussion",
            ),
        ],
        agentTraces=[
            AgentTrace(
                agent="Demo Fixture",
                status="ok",
                summary="Returned local mock paper-to-company memo without external API calls.",
                model=None,
                latencyMs=0,
            )
        ],
    )

