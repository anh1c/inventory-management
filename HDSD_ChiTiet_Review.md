# Review tài liệu HDSD chi tiết DTWare

File được review: `/Users/thainguyen/Downloads/HDSD.docx`

## Kết luận nhanh

Bản hiện tại có nhiều nội dung nền và giải thích chức năng khá đầy đủ, nhưng đang phù hợp hơn với vai trò **tài liệu tham khảo chi tiết** thay vì tài liệu để khách hàng tự đọc và bắt đầu thao tác ngay.

Nên dùng song song:

- `HDSD_Nhanh_DTWare.docx`: tài liệu đọc trước, hướng dẫn thao tác cơ bản.
- `HDSD.docx`: tài liệu chi tiết/phụ lục chức năng, sau khi biên tập lại thuật ngữ, chính tả và cấu trúc.

## Các điểm nên sửa trong bản chi tiết

### 1. Chuẩn hóa thuật ngữ

Hiện tài liệu đang trộn tiếng Việt và tiếng Anh khá nhiều. Nên chọn quy tắc:

- Lần đầu: `Linh kiện / sản phẩm (Part)`
- Sau đó dùng thống nhất: `Linh kiện / sản phẩm` hoặc `Part`, không đổi qua lại liên tục.
- `Stock Item`: nên dịch là `Mặt hàng tồn kho`.
- `Stock Location`: nên dịch là `Vị trí kho`.
- `Purchase Order`: nên dịch là `Đơn mua hàng`.
- `Sales Order`: nên dịch là `Đơn bán hàng`.
- `Build Order`: nên dịch là `Lệnh sản xuất`.
- `Submit`: nên đổi thành `Lưu`, `Xác nhận` hoặc `Gửi` tùy ngữ cảnh.
- `Import Part`, `Add Supplier Data`, `Start New Build`: nên có tiếng Việt kèm nhãn tiếng Anh nếu đúng với giao diện.

### 2. Sửa lỗi chính tả và khoảng trắng

Một số lỗi thấy rõ:

- `Linh kiên` -> `Linh kiện`
- `link kiện` -> `linh kiện`
- `Hệ thông` -> `Hệ thống`
- `trong kho .` -> `trong kho.`
- `hệ thống .` -> `hệ thống.`
- `web-app` -> `ứng dụng web`
- `Purchaseable` nên kiểm tra lại theo giao diện. Nếu giữ thuật ngữ tiếng Anh thì cần viết nhất quán.

Nên chạy một lượt tìm kiếm trong tài liệu với các cụm:

- ` .`
- ` ,`
- `Linh kiên`
- `link kiện`
- `Hệ thông`
- `Purchaseable`
- `Submit`
- `Import`
- `Build Order`

### 3. Cấu trúc heading đang quá phẳng

Nhiều mục con đang dùng `Heading 2`, khiến mục lục dài và khó đọc. Nên tổ chức lại:

- Heading 1: Chương lớn
  - Tổng quan
  - Quản lý linh kiện / sản phẩm
  - Quản lý tồn kho
  - Mua hàng
  - Bán hàng
  - Sản xuất
  - Báo cáo / tra cứu
  - Phụ lục

- Heading 2: Nhóm chức năng
- Heading 3: Thao tác hoặc khái niệm con

Ví dụ hiện tại `Virtual`, `Template`, `Assembly`, `Component` đang ngang cấp với mục lớn. Nên đưa về dưới mục `Thuộc tính linh kiện`.

### 4. Thiếu phần mở đầu theo ngôn ngữ sản phẩm

Nên thêm trước chương I:

## Tổng quan DTWare

DTWare là hệ thống hỗ trợ quản lý kho, mua hàng, bán hàng và sản xuất. Hệ thống giúp doanh nghiệp kiểm soát dữ liệu hàng hóa, vị trí lưu kho, số lượng tồn, đơn đặt hàng và lệnh sản xuất trong cùng một nền tảng.

## Phạm vi tài liệu

Tài liệu này mô tả các chức năng chi tiết của hệ thống DTWare. Người dùng mới nên đọc tài liệu `Hướng dẫn nhanh sử dụng DTWare` trước khi đọc tài liệu này.

## Đối tượng sử dụng

- Nhân viên kho
- Nhân viên mua hàng
- Nhân viên bán hàng
- Nhân viên sản xuất
- Quản lý vận hành
- Quản trị hệ thống

### 5. Thiếu luồng thao tác thực tế

Bản chi tiết có nhiều khái niệm nhưng ít kịch bản thao tác từ đầu đến cuối. Nên bổ sung các luồng:

- Tạo linh kiện mới
- Tạo tồn kho ban đầu
- Tạo nhà cung cấp
- Tạo đơn mua hàng
- Nhận hàng vào kho
- Tạo khách hàng
- Tạo đơn bán hàng
- Phân bổ hàng và xuất kho
- Tạo BOM
- Tạo lệnh sản xuất
- Hoàn thành lệnh sản xuất
- Kiểm kê tồn kho

Mỗi luồng nên theo mẫu:

1. Mục đích
2. Điều kiện trước khi thực hiện
3. Các bước thao tác
4. Kết quả sau khi hoàn thành
5. Lưu ý / lỗi thường gặp

### 6. Nên phân biệt tài liệu nghiệp vụ và tài liệu kỹ thuật

Một số phần như serial pattern, test key, pricing source rất chi tiết. Nên đưa vào phụ lục nếu khách hàng phổ thông đọc lần đầu.

Các phần nên giữ trong nội dung chính:

- Quản lý Part
- Quản lý tồn kho
- Đơn mua hàng
- Đơn bán hàng
- BOM và sản xuất

Các phần nên đưa về phụ lục:

- Mẫu serial nâng cao
- Test template nâng cao
- Pricing source chi tiết
- Quy tắc tracking nâng cao

### 7. Nên bổ sung ảnh chụp màn hình theo từng luồng

Nếu giao cho khách tự trải nghiệm, mỗi luồng chính nên có ảnh:

- Màn hình đăng nhập
- Dashboard
- Danh sách Parts
- Chi tiết Part
- Danh sách Stock
- Tạo Purchase Order
- Nhận hàng
- Tạo Sales Order
- BOM
- Build Order

Ảnh nên có đánh số: `Hình 1`, `Hình 2`, ...

### 8. Nên thêm mục hỗ trợ và thông tin bàn giao

Cuối tài liệu nên có:

- URL hệ thống
- Tài khoản demo / tài khoản được cấp
- Người liên hệ hỗ trợ
- Phạm vi dữ liệu demo
- Lưu ý không dùng dữ liệu demo cho vận hành thật nếu chưa xác nhận

## Mức ưu tiên sửa

### Cần sửa trước khi giao khách

- Thêm phần `Tổng quan DTWare`
- Thêm phần `Bắt đầu nhanh` hoặc đính kèm file hướng dẫn nhanh
- Sửa chính tả rõ ràng
- Chuẩn hóa thuật ngữ
- Đổi các heading để mục lục dễ đọc

### Có thể sửa sau demo

- Thêm ảnh chụp màn hình đầy đủ
- Tách phụ lục nâng cao
- Chuẩn hóa toàn bộ bảng biểu
- Bổ sung các lỗi thường gặp

## Đề xuất cách đóng gói bàn giao

Nên giao khách 2 file:

1. `HDSD_Nhanh_DTWare.docx`
   - Dùng để đọc trước và tự thao tác.
   - Ngắn, theo luồng nghiệp vụ.

2. `HDSD_ChiTiet_DTWare.docx`
   - Dùng để tra cứu sâu.
   - Cần biên tập từ file hiện tại.

Tên file khuyến nghị:

- `DTWare_Huong_Dan_Nhanh_v1.0.docx`
- `DTWare_Huong_Dan_Chi_Tiet_v1.0.docx`

