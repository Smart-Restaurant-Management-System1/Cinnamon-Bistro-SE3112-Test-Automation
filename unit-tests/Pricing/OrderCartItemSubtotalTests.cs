using System.Globalization;
using ReservationService.Models;

namespace CinnamonBistro.UnitTests.Pricing;

/// <summary>
/// Tests for <see cref="OrderCartItem.Subtotal"/> (UnitPrice * Quantity). The application has no discount or
/// rounding logic, so these tests pin down exact decimal arithmetic instead (see README limitations).
/// Prices are passed as strings because C# attributes cannot carry decimal literals.
/// </summary>
public class OrderCartItemSubtotalTests
{
    private static decimal D(string value) => decimal.Parse(value, CultureInfo.InvariantCulture);

    [Theory]
    [InlineData("12.50", 3, "37.50")]
    [InlineData("0.10", 3, "0.30")]        // would be 0.30000000000000004 with binary floating point
    [InlineData("1999.99", 1, "1999.99")]
    [InlineData("4.25", 99, "420.75")]     // maximum quantity accepted by OrderCartService
    [InlineData("0.00", 5, "0.00")]        // free item
    public void Subtotal_UnitPriceTimesQuantity_IsExactDecimal(string unitPrice, int quantity, string expected)
    {
        var item = new OrderCartItem { UnitPrice = D(unitPrice), Quantity = quantity };

        Assert.Equal(D(expected), item.Subtotal);
    }

    [Fact]
    public void Subtotal_ZeroQuantity_IsZero()
    {
        var item = new OrderCartItem { UnitPrice = 9.99m, Quantity = 0 };

        Assert.Equal(0m, item.Subtotal);
    }

    [Fact]
    public void Subtotal_NegativeQuantity_IsNotGuardedAtModelLevelAndYieldsNegativeAmount()
    {
        // Characterisation: the model does not validate; OrderCartService.ValidateQuantity is the guard.
        var item = new OrderCartItem { UnitPrice = 5.00m, Quantity = -2 };

        Assert.Equal(-10.00m, item.Subtotal);
    }

    [Fact]
    public void Subtotal_IsNotRoundedToTwoDecimals()
    {
        // Characterisation: three-decimal prices keep full precision; no rounding step exists in the model.
        var item = new OrderCartItem { UnitPrice = 1.005m, Quantity = 3 };

        Assert.Equal(3.015m, item.Subtotal);
    }

    [Fact]
    public void Subtotal_RecomputesWhenQuantityChanges()
    {
        var item = new OrderCartItem { UnitPrice = 2.50m, Quantity = 2 };
        Assert.Equal(5.00m, item.Subtotal);

        item.Quantity = 4;

        Assert.Equal(10.00m, item.Subtotal);
    }
}
