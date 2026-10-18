using Moq;
using ReservationService.Models;
using ReservationService.Repositories;
using ReservationService.Services;

namespace CinnamonBistro.UnitTests.Pricing;

/// <summary>
/// Unit tests for <see cref="OrderCartService"/> quantity rules (1..99) and cart operations.
/// Repositories are mocked, so no MySQL is needed.
/// </summary>
public class OrderCartServiceTests
{
    private const int CustomerId = 5;
    private const int MenuItemId = 11;

    private readonly Mock<IOrderCartRepository> _carts = new();
    private readonly Mock<IMenuItemRepository> _menu = new();
    private readonly OrderCartService _sut;

    public OrderCartServiceTests()
    {
        _sut = new OrderCartService(_carts.Object, _menu.Object);
    }

    private void StubAvailableMenuItem() =>
        _menu.Setup(m => m.GetByIdAsync(MenuItemId, It.IsAny<CancellationToken>()))
             .ReturnsAsync(new MenuItem { MenuItemId = MenuItemId, Price = 12.50m, IsAvailable = true });

    private void StubCartAfterOperation(params OrderCartItem[] items) =>
        _carts.Setup(c => c.GetByCustomerIdAsync(CustomerId, It.IsAny<CancellationToken>()))
              .ReturnsAsync(new OrderCart { CartId = 1, CustomerId = CustomerId, Items = items.ToList() });

    private void VerifyNoCartWrites()
    {
        _carts.Verify(c => c.AddItemAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        _carts.Verify(c => c.UpdateItemQuantityAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ---------- AddItemAsync: positive ----------

    [Fact]
    public async Task AddItemAsync_ValidItem_AddsToRepositoryAndReturnsReloadedCart()
    {
        StubAvailableMenuItem();
        _carts.Setup(c => c.GetItemAsync(CustomerId, MenuItemId, It.IsAny<CancellationToken>())).ReturnsAsync((OrderCartItem?)null);
        _carts.Setup(c => c.AddItemAsync(CustomerId, MenuItemId, 3, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        StubCartAfterOperation(new OrderCartItem { MenuItemId = MenuItemId, Quantity = 3, UnitPrice = 12.50m });

        var cart = await _sut.AddItemAsync(CustomerId, MenuItemId, 3);

        var line = Assert.Single(cart.Items);
        Assert.Equal(37.50m, line.Subtotal);
        _carts.Verify(c => c.AddItemAsync(CustomerId, MenuItemId, 3, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(99)]
    public async Task AddItemAsync_QuantityAtBoundary_IsAccepted(int quantity)
    {
        StubAvailableMenuItem();
        _carts.Setup(c => c.GetItemAsync(CustomerId, MenuItemId, It.IsAny<CancellationToken>())).ReturnsAsync((OrderCartItem?)null);
        _carts.Setup(c => c.AddItemAsync(CustomerId, MenuItemId, quantity, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        StubCartAfterOperation();

        await _sut.AddItemAsync(CustomerId, MenuItemId, quantity);

        _carts.Verify(c => c.AddItemAsync(CustomerId, MenuItemId, quantity, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AddItemAsync_ExistingLineStillWithinLimitAfterIncrease_IsAccepted()
    {
        StubAvailableMenuItem();
        _carts.Setup(c => c.GetItemAsync(CustomerId, MenuItemId, It.IsAny<CancellationToken>()))
              .ReturnsAsync(new OrderCartItem { MenuItemId = MenuItemId, Quantity = 90 });
        _carts.Setup(c => c.AddItemAsync(CustomerId, MenuItemId, 9, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        StubCartAfterOperation();

        await _sut.AddItemAsync(CustomerId, MenuItemId, 9); // 90 + 9 = 99

        _carts.Verify(c => c.AddItemAsync(CustomerId, MenuItemId, 9, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ---------- AddItemAsync: negative / boundary ----------

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(100)]
    public async Task AddItemAsync_QuantityOutsideOneToNinetyNine_ThrowsAndTouchesNothing(int quantity)
    {
        var ex = await Assert.ThrowsAsync<ArgumentException>(() => _sut.AddItemAsync(CustomerId, MenuItemId, quantity));

        Assert.Contains("between 1 and 99", ex.Message);
        _menu.Verify(m => m.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        VerifyNoCartWrites();
    }

    [Fact]
    public async Task AddItemAsync_ExistingLinePlusNewQuantityExceedsLimit_ThrowsAndDoesNotAdd()
    {
        StubAvailableMenuItem();
        _carts.Setup(c => c.GetItemAsync(CustomerId, MenuItemId, It.IsAny<CancellationToken>()))
              .ReturnsAsync(new OrderCartItem { MenuItemId = MenuItemId, Quantity = 90 });

        await Assert.ThrowsAsync<ArgumentException>(() => _sut.AddItemAsync(CustomerId, MenuItemId, 10)); // 90 + 10 = 100

        VerifyNoCartWrites();
    }

    [Theory]
    [InlineData(0, MenuItemId)]
    [InlineData(-1, MenuItemId)]
    [InlineData(CustomerId, 0)]
    [InlineData(CustomerId, -7)]
    public async Task AddItemAsync_NonPositiveIds_ThrowsArgumentException(int customerId, int menuItemId)
    {
        await Assert.ThrowsAsync<ArgumentException>(() => _sut.AddItemAsync(customerId, menuItemId, 1));

        VerifyNoCartWrites();
    }

    [Fact]
    public async Task AddItemAsync_MenuItemNotFound_ThrowsKeyNotFound()
    {
        _menu.Setup(m => m.GetByIdAsync(MenuItemId, It.IsAny<CancellationToken>())).ReturnsAsync((MenuItem?)null);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _sut.AddItemAsync(CustomerId, MenuItemId, 1));

        VerifyNoCartWrites();
    }

    [Fact]
    public async Task AddItemAsync_MenuItemUnavailable_ThrowsInvalidOperationAndDoesNotAdd()
    {
        _menu.Setup(m => m.GetByIdAsync(MenuItemId, It.IsAny<CancellationToken>()))
             .ReturnsAsync(new MenuItem { MenuItemId = MenuItemId, IsAvailable = false });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.AddItemAsync(CustomerId, MenuItemId, 1));

        Assert.Contains("unavailable", ex.Message);
        VerifyNoCartWrites();
    }

    [Fact]
    public async Task AddItemAsync_RepositoryReportsFailure_ThrowsInvalidOperation()
    {
        StubAvailableMenuItem();
        _carts.Setup(c => c.GetItemAsync(CustomerId, MenuItemId, It.IsAny<CancellationToken>())).ReturnsAsync((OrderCartItem?)null);
        _carts.Setup(c => c.AddItemAsync(CustomerId, MenuItemId, 1, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.AddItemAsync(CustomerId, MenuItemId, 1));
    }

    // ---------- UpdateItemQuantityAsync ----------

    [Fact]
    public async Task UpdateItemQuantityAsync_ExistingLine_UpdatesQuantity()
    {
        StubAvailableMenuItem();
        _carts.Setup(c => c.GetItemAsync(CustomerId, MenuItemId, It.IsAny<CancellationToken>()))
              .ReturnsAsync(new OrderCartItem { MenuItemId = MenuItemId, Quantity = 1 });
        _carts.Setup(c => c.UpdateItemQuantityAsync(CustomerId, MenuItemId, 5, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        StubCartAfterOperation(new OrderCartItem { MenuItemId = MenuItemId, Quantity = 5, UnitPrice = 2m });

        var cart = await _sut.UpdateItemQuantityAsync(CustomerId, MenuItemId, 5);

        Assert.Equal(10m, Assert.Single(cart.Items).Subtotal);
        _carts.Verify(c => c.UpdateItemQuantityAsync(CustomerId, MenuItemId, 5, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    [InlineData(100)]
    public async Task UpdateItemQuantityAsync_InvalidQuantity_Throws(int quantity)
    {
        await Assert.ThrowsAsync<ArgumentException>(() => _sut.UpdateItemQuantityAsync(CustomerId, MenuItemId, quantity));

        VerifyNoCartWrites();
    }

    [Fact]
    public async Task UpdateItemQuantityAsync_ItemNotInCart_ThrowsKeyNotFound()
    {
        StubAvailableMenuItem();
        _carts.Setup(c => c.GetItemAsync(CustomerId, MenuItemId, It.IsAny<CancellationToken>())).ReturnsAsync((OrderCartItem?)null);

        var ex = await Assert.ThrowsAsync<KeyNotFoundException>(() => _sut.UpdateItemQuantityAsync(CustomerId, MenuItemId, 2));

        Assert.Contains("cart", ex.Message);
        VerifyNoCartWrites();
    }

    // ---------- RemoveItemAsync ----------

    [Fact]
    public async Task RemoveItemAsync_ItemNotInCart_ThrowsKeyNotFoundAndNeverRemoves()
    {
        _carts.Setup(c => c.GetItemAsync(CustomerId, MenuItemId, It.IsAny<CancellationToken>())).ReturnsAsync((OrderCartItem?)null);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _sut.RemoveItemAsync(CustomerId, MenuItemId));

        _carts.Verify(c => c.RemoveItemAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RemoveItemAsync_ExistingLine_RemovesAndReturnsCart()
    {
        _carts.Setup(c => c.GetItemAsync(CustomerId, MenuItemId, It.IsAny<CancellationToken>()))
              .ReturnsAsync(new OrderCartItem { MenuItemId = MenuItemId, Quantity = 2 });
        _carts.Setup(c => c.RemoveItemAsync(CustomerId, MenuItemId, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        StubCartAfterOperation();

        var cart = await _sut.RemoveItemAsync(CustomerId, MenuItemId);

        Assert.Empty(cart.Items);
        _carts.Verify(c => c.RemoveItemAsync(CustomerId, MenuItemId, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ---------- ClearCartAsync / empty cart ----------

    [Fact]
    public async Task ClearCartAsync_EmptyCart_ReturnsEmptyCartWithoutHittingRepositoryClear()
    {
        StubCartAfterOperation(); // cart exists but has no items

        var cart = await _sut.ClearCartAsync(CustomerId);

        Assert.Empty(cart.Items);
        Assert.Equal(CustomerId, cart.CustomerId);
        _carts.Verify(c => c.ClearCartAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ClearCartAsync_NoCartAtAll_ReturnsEmptyCart()
    {
        _carts.Setup(c => c.GetByCustomerIdAsync(CustomerId, It.IsAny<CancellationToken>())).ReturnsAsync((OrderCart?)null);

        var cart = await _sut.ClearCartAsync(CustomerId);

        Assert.Empty(cart.Items);
        _carts.Verify(c => c.ClearCartAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ClearCartAsync_CartWithItems_ClearsOnceAndReturnsEmptyCart()
    {
        StubCartAfterOperation(new OrderCartItem { MenuItemId = MenuItemId, Quantity = 2 });
        _carts.Setup(c => c.ClearCartAsync(CustomerId, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var cart = await _sut.ClearCartAsync(CustomerId);

        Assert.Empty(cart.Items);
        _carts.Verify(c => c.ClearCartAsync(CustomerId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task GetCartAsync_NonPositiveCustomerId_ThrowsWithoutQueryingRepository(int customerId)
    {
        var ex = await Assert.ThrowsAsync<ArgumentException>(() => _sut.GetCartAsync(customerId));

        Assert.Contains("customer ID", ex.Message);
        _carts.Verify(c => c.GetByCustomerIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
