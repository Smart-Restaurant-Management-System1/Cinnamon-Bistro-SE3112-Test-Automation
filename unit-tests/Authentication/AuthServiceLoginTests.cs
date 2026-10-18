using IdentityService.DTOs;
using IdentityService.Models;
using IdentityService.Repositories;
using IdentityService.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CinnamonBistro.UnitTests.Authentication;

/// <summary>
/// Unit tests for <see cref="AuthService.LoginAsync"/>. The unit under test is the real AuthService;
/// only its collaborators (repository, hasher, token generator, email validator) are mocked,
/// so no MySQL/Kafka is needed.
/// </summary>
public class AuthServiceLoginTests
{
    private static readonly DateTime FixedExpiry = new(2026, 10, 18, 12, 0, 0, DateTimeKind.Utc);

    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<IJwtTokenGenerator> _jwt = new();
    private readonly Mock<IEmailValidatorService> _emailValidator = new();
    private readonly AuthService _sut;

    public AuthServiceLoginTests()
    {
        _sut = new AuthService(
            _users.Object,
            _hasher.Object,
            _jwt.Object,
            _emailValidator.Object,
            new ConfigurationBuilder().Build(),
            NullLogger<AuthService>.Instance);
    }

    private static User ActiveUser(params string[] roles) => new()
    {
        UserId = 42,
        FullName = "Nimal Perera",
        Email = "nimal@example.com",
        PhoneNumber = "0771234567",
        PasswordHash = "stored-hash",
        IsActive = true,
        Status = "Active",
        Roles = roles.ToList()
    };

    private static LoginRequestDto Login(string email = "nimal@example.com", string password = "Secret#123") =>
        new() { Email = email, Password = password };

    // ---------- Positive ----------

    [Fact]
    public async Task LoginAsync_ValidCredentials_ReturnsTokenAndUserClaims()
    {
        // Arrange
        var user = ActiveUser("Customer");
        _users.Setup(r => r.GetByEmailAsync("nimal@example.com")).ReturnsAsync(user);
        _hasher.Setup(h => h.VerifyPassword("Secret#123", "stored-hash")).Returns(true);
        _jwt.Setup(j => j.GenerateToken(user, user.Roles)).Returns(("signed.jwt.token", FixedExpiry));

        // Act
        var response = await _sut.LoginAsync(Login());

        // Assert: state
        Assert.Equal("signed.jwt.token", response.Token);
        Assert.Equal(FixedExpiry, response.ExpiresAt);
        Assert.Equal(42, response.UserId);
        Assert.Equal("Nimal Perera", response.FullName);
        Assert.Equal("nimal@example.com", response.Email);
        Assert.Equal(new[] { "Customer" }, response.Roles);

        // Assert: behaviour - the token was minted exactly once, for this user and these roles
        _jwt.Verify(j => j.GenerateToken(user, user.Roles), Times.Once);
        _hasher.Verify(h => h.VerifyPassword("Secret#123", "stored-hash"), Times.Once);
    }

    [Fact]
    public async Task LoginAsync_EmailWithSurroundingWhitespace_IsTrimmedBeforeLookup()
    {
        var user = ActiveUser("Admin");
        _users.Setup(r => r.GetByEmailAsync("nimal@example.com")).ReturnsAsync(user);
        _hasher.Setup(h => h.VerifyPassword(It.IsAny<string>(), It.IsAny<string>())).Returns(true);
        _jwt.Setup(j => j.GenerateToken(It.IsAny<User>(), It.IsAny<IList<string>>())).Returns(("t", FixedExpiry));

        var response = await _sut.LoginAsync(Login(email: "  nimal@example.com  "));

        Assert.Equal(new[] { "Admin" }, response.Roles);
        _users.Verify(r => r.GetByEmailAsync("nimal@example.com"), Times.Once);
    }

    // ---------- Negative: bad credentials ----------

    [Fact]
    public async Task LoginAsync_UnknownEmail_ThrowsUnauthorizedAndNeverChecksPasswordOrMintsToken()
    {
        _users.Setup(r => r.GetByEmailAsync(It.IsAny<string>())).ReturnsAsync((User?)null);

        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _sut.LoginAsync(Login()));

        Assert.Equal("Invalid email or password.", ex.Message);
        _hasher.Verify(h => h.VerifyPassword(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        _jwt.Verify(j => j.GenerateToken(It.IsAny<User>(), It.IsAny<IList<string>>()), Times.Never);
    }

    [Fact]
    public async Task LoginAsync_WrongPassword_ThrowsUnauthorizedWithSameMessageAsUnknownEmail()
    {
        var user = ActiveUser("Customer");
        _users.Setup(r => r.GetByEmailAsync("nimal@example.com")).ReturnsAsync(user);
        _hasher.Setup(h => h.VerifyPassword("wrong", "stored-hash")).Returns(false);

        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _sut.LoginAsync(Login(password: "wrong")));

        // Same message as the unknown-email case, so callers cannot enumerate registered emails.
        Assert.Equal("Invalid email or password.", ex.Message);
        _jwt.Verify(j => j.GenerateToken(It.IsAny<User>(), It.IsAny<IList<string>>()), Times.Never);
    }

    // ---------- Negative: disabled accounts ----------

    [Fact]
    public async Task LoginAsync_BlockedAccount_ThrowsAccountDeactivatedWithBlockedReason_WithoutCheckingPassword()
    {
        var user = ActiveUser("Customer");
        user.Status = "Blocked";
        _users.Setup(r => r.GetByEmailAsync("nimal@example.com")).ReturnsAsync(user);

        var ex = await Assert.ThrowsAsync<AccountDeactivatedException>(() => _sut.LoginAsync(Login()));

        Assert.Equal("Blocked", ex.Reason);
        Assert.Contains("blocked", ex.Message, StringComparison.OrdinalIgnoreCase);
        _hasher.Verify(h => h.VerifyPassword(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        _jwt.Verify(j => j.GenerateToken(It.IsAny<User>(), It.IsAny<IList<string>>()), Times.Never);
    }

    [Theory]
    [InlineData("InactiveFlag")]
    [InlineData("SoftDeleted")]
    [InlineData("InactiveStatus")]
    public async Task LoginAsync_DeactivatedAccount_ThrowsAccountDeactivatedWithInactiveReason(string scenario)
    {
        var user = ActiveUser("Customer");
        switch (scenario)
        {
            case "InactiveFlag": user.IsActive = false; break;
            case "SoftDeleted": user.DeletedAt = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc); break;
            case "InactiveStatus": user.Status = "Inactive"; break;
        }
        _users.Setup(r => r.GetByEmailAsync("nimal@example.com")).ReturnsAsync(user);

        var ex = await Assert.ThrowsAsync<AccountDeactivatedException>(() => _sut.LoginAsync(Login()));

        Assert.Equal("Inactive", ex.Reason);
        Assert.Contains("deactivated", ex.Message, StringComparison.OrdinalIgnoreCase);
        _jwt.Verify(j => j.GenerateToken(It.IsAny<User>(), It.IsAny<IList<string>>()), Times.Never);
    }

    [Theory]
    [InlineData("blocked")]
    [InlineData("BLOCKED")]
    public async Task LoginAsync_BlockedStatus_IsMatchedCaseInsensitively(string status)
    {
        var user = ActiveUser("Customer");
        user.Status = status;
        _users.Setup(r => r.GetByEmailAsync(It.IsAny<string>())).ReturnsAsync(user);

        var ex = await Assert.ThrowsAsync<AccountDeactivatedException>(() => _sut.LoginAsync(Login()));

        Assert.Equal("Blocked", ex.Reason);
    }

    [Fact]
    public async Task LoginAsync_DisabledAccount_IsStillCatchableAsUnauthorizedAccessException()
    {
        // Callers that only catch UnauthorizedAccessException (e.g. the controller) still handle disabled accounts.
        var user = ActiveUser("Customer");
        user.IsActive = false;
        _users.Setup(r => r.GetByEmailAsync(It.IsAny<string>())).ReturnsAsync(user);

        await Assert.ThrowsAnyAsync<UnauthorizedAccessException>(() => _sut.LoginAsync(Login()));
    }
}
