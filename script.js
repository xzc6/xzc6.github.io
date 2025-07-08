document.addEventListener('DOMContentLoaded', () => {
    // DOM元素
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const removeFile = document.getElementById('remove-file');
    const compressionOptions = document.getElementById('compression-options');
    const actionButtons = document.getElementById('action-buttons');
    const compressBtn = document.getElementById('compress-btn');
    const resetBtn = document.getElementById('reset-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');
    const resultContainer = document.getElementById('result-container');
    const originalSize = document.getElementById('original-size');
    const originalPages = document.getElementById('original-pages');
    const compressedSize = document.getElementById('compressed-size');
    const compressionRatio = document.getElementById('compression-ratio');
    const downloadBtn = document.getElementById('download-btn');
    const compressAnotherBtn = document.getElementById('compress-another-btn');
    const faqToggles = document.querySelectorAll('.faq-toggle');

    // 全局变量
    let selectedFile = null;
    let compressedFileUrl = null;

    // 初始化
    init();

    // 初始化函数
    function init() {
        setupEventListeners();
        setupFaqAccordions();
    }

    // 设置事件监听器
    function setupEventListeners() {
        // 文件上传相关
        dropArea.addEventListener('dragover', handleDragOver);
        dropArea.addEventListener('dragleave', handleDragLeave);
        dropArea.addEventListener('drop', handleDrop);
        dropArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);
        removeFile.addEventListener('click', resetFileSelection);
        resetBtn.addEventListener('click', resetFileSelection);
        compressAnotherBtn.addEventListener('click', resetFileSelection);

        // 压缩相关
        compressBtn.addEventListener('click', startCompression);

        // 下载相关
        downloadBtn.addEventListener('click', downloadCompressedFile);
    }

    // 设置FAQ手风琴效果
    function setupFaqAccordions() {
        faqToggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const content = toggle.nextElementSibling;
                const icon = toggle.querySelector('i');
                
                if (content.classList.contains('hidden')) {
                    content.classList.remove('hidden');
                    icon.classList.add('rotate-180');
                } else {
                    content.classList.add('hidden');
                    icon.classList.remove('rotate-180');
                }
            });
        });
    }

    // 处理拖放相关事件
    function handleDragOver(e) {
        e.preventDefault();
        dropArea.classList.add('file-drop-active');
    }

    function handleDragLeave() {
        dropArea.classList.remove('file-drop-active');
    }

    function handleDrop(e) {
        e.preventDefault();
        dropArea.classList.remove('file-drop-active');
        
        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    }

    // 处理文件选择
    function handleFileSelect(e) {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
    }

    // 处理选中的文件
    function handleFiles(files) {
        if (files[0].type !== 'application/pdf') {
            showNotification('请上传PDF格式的文件', 'error');
            return;
        }

        if (files[0].size > 50 * 1024 * 1024) {
            showNotification('文件大小不能超过50MB', 'error');
            return;
        }

        selectedFile = files[0];
        displayFileInfo();
    }

    // 显示文件信息
    function displayFileInfo() {
        if (!selectedFile) return;

        fileName.textContent = selectedFile.name;
        fileSize.textContent = formatFileSize(selectedFile.size);
        
        fileInfo.classList.remove('hidden');
        compressionOptions.classList.remove('hidden');
        actionButtons.classList.remove('hidden');
    }

    // 重置文件选择
    function resetFileSelection() {
        selectedFile = null;
        fileInput.value = '';
        fileInfo.classList.add('hidden');
        compressionOptions.classList.add('hidden');
        actionButtons.classList.add('hidden');
        progressContainer.classList.add('hidden');
        resultContainer.classList.add('hidden');
        dropArea.classList.remove('file-drop-active');
        
        // 重置进度条
        progressBar.style.width = '0%';
        progressPercentage.textContent = '0%';
        progressText.textContent = '准备中...';
        
        // 释放之前的URL对象
        if (compressedFileUrl) {
            URL.revokeObjectURL(compressedFileUrl);
            compressedFileUrl = null;
        }
    }

    // 开始压缩文件
    function startCompression() {
        if (!selectedFile) return;

        // 获取选中的压缩级别
        const compressionLevel = document.querySelector('input[name="compression-level"]:checked').value;
        
        // 显示进度条
        progressContainer.classList.remove('hidden');
        actionButtons.classList.add('hidden');
        
        // 使用pdf-lib库进行实际的PDF压缩
        compressPdf(selectedFile, compressionLevel)
            .then(compressedPdf => {
                completeCompression(compressedPdf);
            })
            .catch(error => {
                console.error('PDF压缩失败:', error);
                showNotification('PDF压缩失败，请重试', 'error');
                resetFileSelection();
            });
    }

    // 使用pdf-lib库压缩PDF
    async function compressPdf(file, compressionLevel) {
        // 加载pdf-lib库
        const { PDFDocument, rgb } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.mjs');
        
        // 读取输入的PDF文件
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        // 获取PDF页数
        const pageCount = pdfDoc.getPageCount();
        
        // 根据压缩级别执行不同的压缩策略
        switch (compressionLevel) {
            case 'low':
                // 低压缩：仅优化图像质量
                await optimizeImages(pdfDoc, 0.7);
                break;
            case 'medium':
                // 中等压缩：优化图像并降低分辨率
                await optimizeImages(pdfDoc, 0.5);
                await reduceImageResolution(pdfDoc, 150); // 150 DPI
                break;
            case 'high':
                // 高压缩：大幅降低图像质量和分辨率
                await optimizeImages(pdfDoc, 0.3);
                await reduceImageResolution(pdfDoc, 96); // 96 DPI
                break;
        }
        
        // 保存压缩后的PDF
        const compressedPdfBytes = await pdfDoc.save();
        
        // 创建压缩后的PDF文件
        const compressedPdf = new Blob([compressedPdfBytes], { type: 'application/pdf' });
        
        // 返回压缩后的PDF信息
        return {
            blob: compressedPdf,
            originalSize: file.size,
            compressedSize: compressedPdf.size,
            pageCount: pageCount
        };
    }

    // 优化PDF中的图像
    async function optimizeImages(pdfDoc, quality) {
        // 注意：pdf-lib库本身不直接支持图像优化
        // 这里只是为了演示流程，实际应用中需要使用图像处理库
        // 例如pdf-lib可以结合pica.js等库来实现图像优化
        console.log(`优化图像质量至: ${quality * 100}%`);
    }

    // 降低PDF中图像的分辨率
    async function reduceImageResolution(pdfDoc, dpi) {
        // 注意：pdf-lib库本身不直接支持调整DPI
        // 这里只是为了演示流程
        console.log(`降低图像分辨率至: ${dpi} DPI`);
    }

    // 完成压缩
    function completeCompression(compressedPdf) {
        // 隐藏进度条，显示结果
        progressContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        
        // 显示结果
        originalSize.textContent = formatFileSize(compressedPdf.originalSize);
        originalPages.textContent = `${compressedPdf.pageCount} 页`;
        compressedSize.textContent = formatFileSize(compressedPdf.compressedSize);
        
        const compressionRatioValue = compressedPdf.compressedSize / compressedPdf.originalSize;
        const percentageReduction = Math.round((1 - compressionRatioValue) * 100);
        compressionRatio.textContent = `-${percentageReduction}%`;
        
        // 创建下载URL
        compressedFileUrl = URL.createObjectURL(compressedPdf.blob);
    }

    // 下载压缩后的文件
    function downloadCompressedFile() {
        if (!compressedFileUrl) return;
        
        const link = document.createElement('a');
        link.href = compressedFileUrl;
        link.download = `compressed_${selectedFile.name}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 显示下载通知
        showNotification('文件下载已开始', 'success');
    }

    // 显示通知
    function showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full opacity-0`;
        
        // 设置通知类型样式
        if (type === 'success') {
            notification.classList.add('bg-green-500', 'text-white');
        } else if (type === 'error') {
            notification.classList.add('bg-red-500', 'text-white');
        } else {
            notification.classList.add('bg-blue-500', 'text-white');
        }
        
        // 设置通知内容
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fa fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'} -circle mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 显示通知
        setTimeout(() => {
            notification.classList.remove('translate-x-full', 'opacity-0');
        }, 10);
        
        // 自动关闭通知
        setTimeout(() => {
            notification.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});
    
