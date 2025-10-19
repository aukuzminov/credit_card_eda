# Credit Card Default - Interactive EDA Web App

A browser-only, GitHub Pages-deployable interactive web application for Exploratory Data Analysis (EDA) on the Kaggle Credit Card Default dataset.

## 🚀 Quick Start

1. **Visit the app** (after deployment): `https://your-username.github.io/credit-card-eda/`
2. **Upload your data**: Select `train.csv` (required) and `test.csv` (optional)
3. **Click "Load Data"**: The app automatically performs comprehensive EDA
4. **Explore insights**: View statistics, charts, and correlations
5. **Export results**: Download merged CSV or statistics JSON

## 📊 Features

### Data Analysis
- **Data Overview**: Dataset shape, sample preview (10 rows)
- **Missing Values**: Percentage analysis with visualization
- **Descriptive Statistics**: Mean, median, std dev, quartiles for numeric features
- **Categorical Analysis**: Value counts and percentages
- **Grouped Statistics**: Compare features by default status (0 vs 1)
- **Correlation Matrix**: Heatmap for numeric features

### Visualizations
- **Demographics**: Gender, Education, Marriage, Age distributions
- **Financial**: Credit limit histogram
- **Default Rates**: Default rate by gender and education
- **Correlation Heatmap**: Color-coded correlation matrix

### Export Options
- **CSV**: Download merged dataset
- **JSON**: Download complete statistics summary

## 🗂️ Dataset Schema

The app analyzes the following columns:

| Column | Type | Description |
|--------|------|-------------|
| `ID` | Identifier | Excluded from analysis |
| `LIMIT_BAL` | Numeric | Credit limit (NT$) |
| `SEX` | Categorical | 1=Male, 2=Female |
| `EDUCATION` | Categorical | 1=Grad, 2=Univ, 3=HS, 4=Others |
| `MARRIAGE` | Categorical | 1=Married, 2=Single, 3=Others |
| `AGE` | Numeric | Age in years |
| `PAY_0` to `PAY_6` | Categorical | Repayment status (Sept-Apr 2005) |
| `BILL_AMT1` to `BILL_AMT6` | Numeric | Bill amounts (Sept-Apr) |
| `PAY_AMT1` to `PAY_AMT6` | Numeric | Payment amounts (Sept-Apr) |
| `default.payment.next.month` | Target | 0=No default, 1=Default |

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Libraries**:
  - [PapaParse](https://www.papaparse.com/) 5.4.1 - CSV parsing
  - [Chart.js](https://www.chartjs.org/) 4.4.0 - Visualizations
- **Hosting**: GitHub Pages
- **No build step required** - Pure client-side application

## 📦 Files

```
credit-card-eda/
├── index.html          # UI structure and styling (428 lines)
├── app.js              # All JavaScript logic (1,217 lines)
├── README.md           # This file
├── IMPLEMENTATION_PLAN.md  # Detailed implementation plan
└── VERIFICATION.md     # Comprehensive verification report
```

## 🚢 Deployment to GitHub Pages

1. **Create a public GitHub repository**
   ```bash
   git init
   git add index.html app.js README.md
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/username/credit-card-eda.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**
   - Go to repository **Settings** → **Pages**
   - Source: **Deploy from branch**
   - Branch: **main**
   - Folder: **/ (root)**
   - Click **Save**

3. **Access your app**
   - Wait 2-3 minutes for deployment
   - Visit: `https://username.github.io/credit-card-eda/`

## 🔄 Adapting for Other Datasets

The app is designed for easy reuse with other datasets. Just modify the `CONFIG` object in `app.js`:

```javascript
// Lines 9-41 in app.js
const CONFIG = {
    schema: {
        identifier: 'YourIDColumn',      // Change to your ID column
        target: 'YourTargetColumn',      // Change to your target
        demographics: ['Col1', 'Col2'],  // Your categorical columns
        // ... etc
    },
    categorical: ['Col1', 'Col2'],       // List categorical columns
    labels: {                            // Human-readable labels
        Col1: {0: 'Label0', 1: 'Label1'}
    }
};
```

See `IMPLEMENTATION_PLAN.md` for detailed reusability guidelines.

## 📋 Requirements

- **Browser**: Modern browser with ES6+ support (Chrome, Firefox, Safari, Edge)
- **Dataset**: CSV format with headers
- **File Size**: Recommended <50MB for optimal performance
- **Internet**: Required for CDN libraries (PapaParse, Chart.js)

## ✅ Verification

All functionality has been verified:
- ✅ JavaScript syntax validated
- ✅ All 34 functions implemented
- ✅ Error handling tested
- ✅ Responsive design confirmed
- ✅ Export functions working
- ✅ Chart rendering verified

See `VERIFICATION.md` for complete verification report.

## 🎯 Use Cases

- **Data Scientists**: Quick EDA on credit risk datasets
- **Students**: Learn about credit default patterns
- **Researchers**: Analyze credit card behavior
- **Educators**: Demonstrate EDA techniques
- **Anyone**: No-code data exploration

## 🐛 Known Limitations

1. **Performance**: Large datasets (>100K rows) may be slow
2. **Correlation**: Limited to 10 features for readability
3. **Charts**: Basic interactivity (tooltips only)
4. **Offline**: Requires internet for CDN libraries

## 📝 License

Free to use and modify. No attribution required.

## 🤝 Contributing

This is a standalone educational project. Feel free to fork and customize!

## 📧 Support

For issues or questions, refer to:
- `IMPLEMENTATION_PLAN.md` - Technical details
- `VERIFICATION.md` - Testing and verification
- Browser console for debugging (F12)

---

**Built with**: Vanilla JavaScript, Chart.js, and PapaParse
**Deployment**: GitHub Pages
**Status**: Production-ready ✅

*Happy Exploring! 📊*
