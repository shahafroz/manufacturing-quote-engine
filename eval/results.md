| Model | Triangles | Watertight | Ours (min) | PrusaSlicer (min) | Time error | Ours (g) | PrusaSlicer (g) | Filament error | Analyze + slice |
|---|---:|:---:|---:|---:|---:|---:|---:|---:|---:|
| cube20_ascii | 12 | ✓ | 17.4 | 18.8 | -7.7% | 3.9 | 4.02 | -2.2% | 6 ms |
| cube20_binary | 12 | ✓ | 17.4 | 18.8 | -7.7% | 3.9 | 4.02 | -2.2% | 7 ms |
| hollow_cube | 24 | ✓ | 20.3 | 23.6 | -13.7% | 4.2 | 4.42 | -5% | 4 ms |
| pumpkin_1 | 330,708 | ✗ | 169 | 274.4 | -38.4% | 38.3 | 45.56 | -15.9% | 1307 ms |
| pumpkin_2 | 187,626 | ✗ | 216.7 | 329.4 | -34.2% | 50.2 | 57.47 | -12.7% | 906 ms |
| pumpkin_3 | 357,496 | ✗ | 173.8 | 264.6 | -34.3% | 38.8 | 44.44 | -12.8% | 1220 ms |
| sphere_r10 | 2,208 | ✓ | 13.1 | 12.2 | 7.6% | 2.4 | 2.22 | 6.9% | 8 ms |

**7 models.** Mean absolute error: print time **20.5%** (bias -18.3%), filament **8.2%** (bias -6.3%).
