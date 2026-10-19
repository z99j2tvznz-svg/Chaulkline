## Threshold sweep on the internal validation session (12 training-side pictures; picks the threshold)
| Finder | Pictures | Balls | Found | Far found | Near found | False balls | Precision | False per picture | Centre error px (median / mean) | In-pocket found |
|---|---|---|---|---|---|---|---|---|---|---|
| conf >= 0.1 (F1 1.000) | 12 | 69 | 69 (100%) | 100% of 34 | 100% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/1 |
| conf >= 0.2 (F1 1.000) | 12 | 69 | 69 (100%) | 100% of 34 | 100% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/1 |
| conf >= 0.3 (F1 1.000) | 12 | 69 | 69 (100%) | 100% of 34 | 100% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/1 |
| conf >= 0.4 (F1 1.000) | 12 | 69 | 69 (100%) | 100% of 34 | 100% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/1 |
| conf >= 0.5 (F1 1.000) | 12 | 69 | 69 (100%) | 100% of 34 | 100% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/1 |
| conf >= 0.6 (F1 1.000) | 12 | 69 | 69 (100%) | 100% of 34 | 100% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/1 |
| conf >= 0.7 (F1 0.993) | 12 | 69 | 68 (99%) | 100% of 34 | 97% | 0 | 100% | 0.00 | 0.6 / 0.6 | 0/1 |
| conf >= 0.8 (F1 0.930) | 12 | 69 | 60 (87%) | 94% of 34 | 80% | 0 | 100% | 0.00 | 0.6 / 0.6 | 0/1 |
| conf >= 0.9 (F1 0.000) | 12 | 69 | 0 (0%) | 0% of 34 | 0% | 0 | 0% | 0.00 | 0.0 / 0.0 | 0/1 |

Chosen threshold: 0.35 (middle of the range with the best F1 on the internal validation session: 0.1 to 0.6)

### A. Checking crops, all (24)
| Finder | Pictures | Balls | Found | Far found | Near found | False balls | Precision | False per picture | Centre error px (median / mean) | In-pocket found |
|---|---|---|---|---|---|---|---|---|---|---|
| new detector, conf >= 0.35 | 24 | 130 | 129 (99%) | 99% of 67 | 100% | 1 | 99% | 0.04 | 0.6 / 0.8 | 0/0 |
| … (sweep, not chosen) conf >= 0.1 | 24 | 130 | 129 (99%) | 99% of 67 | 100% | 4 | 97% | 0.17 | 0.6 / 0.8 | 0/0 |
| … (sweep, not chosen) conf >= 0.25 | 24 | 130 | 129 (99%) | 99% of 67 | 100% | 1 | 99% | 0.04 | 0.6 / 0.8 | 0/0 |
| … (sweep, not chosen) conf >= 0.5 | 24 | 130 | 128 (98%) | 97% of 67 | 100% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/0 |
| … (sweep, not chosen) conf >= 0.7 | 24 | 130 | 126 (97%) | 96% of 67 | 98% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/0 |
| … (sweep, not chosen) conf >= 0.85 | 24 | 130 | 28 (22%) | 7% of 67 | 37% | 0 | 100% | 0.00 | 0.8 / 0.8 | 0/0 |

### … Oct 16 crops (12)
| Finder | Pictures | Balls | Found | Far found | Near found | False balls | Precision | False per picture | Centre error px (median / mean) | In-pocket found |
|---|---|---|---|---|---|---|---|---|---|---|
| new detector, conf >= 0.35 | 12 | 61 | 61 (100%) | 100% of 26 | 100% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/0 |
| … (sweep, not chosen) conf >= 0.1 | 12 | 61 | 61 (100%) | 100% of 26 | 100% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/0 |
| … (sweep, not chosen) conf >= 0.25 | 12 | 61 | 61 (100%) | 100% of 26 | 100% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/0 |
| … (sweep, not chosen) conf >= 0.5 | 12 | 61 | 61 (100%) | 100% of 26 | 100% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/0 |
| … (sweep, not chosen) conf >= 0.7 | 12 | 61 | 61 (100%) | 100% of 26 | 100% | 0 | 100% | 0.00 | 0.6 / 0.7 | 0/0 |
| … (sweep, not chosen) conf >= 0.85 | 12 | 61 | 18 (30%) | 8% of 26 | 46% | 0 | 100% | 0.00 | 0.7 / 0.7 | 0/0 |

### … hall crops (12)
| Finder | Pictures | Balls | Found | Far found | Near found | False balls | Precision | False per picture | Centre error px (median / mean) | In-pocket found |
|---|---|---|---|---|---|---|---|---|---|---|
| new detector, conf >= 0.35 | 12 | 69 | 68 (99%) | 98% of 41 | 100% | 1 | 99% | 0.08 | 0.7 / 0.8 | 0/0 |
| … (sweep, not chosen) conf >= 0.1 | 12 | 69 | 68 (99%) | 98% of 41 | 100% | 4 | 94% | 0.33 | 0.7 / 0.8 | 0/0 |
| … (sweep, not chosen) conf >= 0.25 | 12 | 69 | 68 (99%) | 98% of 41 | 100% | 1 | 99% | 0.08 | 0.7 / 0.8 | 0/0 |
| … (sweep, not chosen) conf >= 0.5 | 12 | 69 | 67 (97%) | 95% of 41 | 100% | 0 | 100% | 0.00 | 0.7 / 0.8 | 0/0 |
| … (sweep, not chosen) conf >= 0.7 | 12 | 69 | 65 (94%) | 93% of 41 | 96% | 0 | 100% | 0.00 | 0.7 / 0.8 | 0/0 |
| … (sweep, not chosen) conf >= 0.85 | 12 | 69 | 10 (14%) | 7% of 41 | 25% | 0 | 100% | 0.00 | 0.9 / 0.9 | 0/0 |

### B. Checking full frames, whole frame (29)
| Finder | Pictures | Balls | Found | Far found | Near found | False balls | Precision | False per picture | Centre error px (median / mean) | In-pocket found |
|---|---|---|---|---|---|---|---|---|---|---|
| new detector, conf >= 0.35 | 29 | 153 | 153 (100%) | 100% of 98 | 100% | 0 | 100% | 0.00 | 1.0 / 1.1 | 0/0 |
| … (sweep, not chosen) conf >= 0.1 | 29 | 153 | 153 (100%) | 100% of 98 | 100% | 2 | 99% | 0.07 | 1.0 / 1.0 | 0/0 |
| … (sweep, not chosen) conf >= 0.25 | 29 | 153 | 153 (100%) | 100% of 98 | 100% | 1 | 99% | 0.03 | 1.0 / 1.0 | 0/0 |
| … (sweep, not chosen) conf >= 0.5 | 29 | 153 | 153 (100%) | 100% of 98 | 100% | 0 | 100% | 0.00 | 1.0 / 1.1 | 0/0 |
| … (sweep, not chosen) conf >= 0.7 | 29 | 153 | 151 (99%) | 98% of 98 | 100% | 0 | 100% | 0.00 | 1.0 / 1.0 | 0/0 |
| … (sweep, not chosen) conf >= 0.85 | 29 | 153 | 25 (16%) | 19% of 98 | 11% | 0 | 100% | 0.00 | 1.0 / 1.0 | 0/0 |

### B. Checking full frames, inside the table outline (29)
| Finder | Pictures | Balls | Found | Far found | Near found | False balls | Precision | False per picture | Centre error px (median / mean) | In-pocket found |
|---|---|---|---|---|---|---|---|---|---|---|
| new detector, conf >= 0.35 | 29 | 153 | 153 (100%) | 100% of 98 | 100% | 0 | 100% | 0.00 | 1.0 / 1.1 | 0/0 |
| … (sweep, not chosen) conf >= 0.1 | 29 | 153 | 153 (100%) | 100% of 98 | 100% | 1 | 99% | 0.03 | 1.0 / 1.0 | 0/0 |
| … (sweep, not chosen) conf >= 0.25 | 29 | 153 | 153 (100%) | 100% of 98 | 100% | 1 | 99% | 0.03 | 1.0 / 1.0 | 0/0 |
| … (sweep, not chosen) conf >= 0.5 | 29 | 153 | 153 (100%) | 100% of 98 | 100% | 0 | 100% | 0.00 | 1.0 / 1.1 | 0/0 |
| … (sweep, not chosen) conf >= 0.7 | 29 | 153 | 151 (99%) | 98% of 98 | 100% | 0 | 100% | 0.00 | 1.0 / 1.0 | 0/0 |
| … (sweep, not chosen) conf >= 0.85 | 29 | 153 | 25 (16%) | 19% of 98 | 11% | 0 | 100% | 0.00 | 1.0 / 1.0 | 0/0 |
